#!/usr/bin/env python3
"""
Production Agent Skeleton — build your product from this template.

Compared to the component reference implementations (s01-s17), this adds:
  - externalized config (env + YAML)
  - structured logging
  - retry + timeout on model calls
  - tool registry with input schema validation
  - a permission checkpoint before every tool execution
  - path safety
  - trajectory capture (JSONL, raw material for future fine-tuning)
  - graceful shutdown

Run:  python agent.py
Need: pip install anthropic python-dotenv pyyaml + .env with ANTHROPIC_API_KEY
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import yaml
from anthropic import Anthropic, APIStatusError, APITimeoutError, APIConnectionError
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv(override=True)

WORKDIR = Path.cwd().resolve()
LOG = logging.getLogger("agent")
TRAJECTORY_DIR = WORKDIR / ".trajectories"


def load_config() -> dict:
    """Load optional declarative config; env vars take precedence."""
    config: dict = {
        "model": os.getenv("MODEL_ID", "claude-sonnet-4-6"),
        "max_tokens": int(os.getenv("MAX_TOKENS", "8000")),
        "timeout_seconds": float(os.getenv("TIMEOUT_SECONDS", "120")),
        "max_retries": int(os.getenv("MAX_RETRIES", "3")),
        "base_delay_seconds": float(os.getenv("BASE_DELAY_SECONDS", "0.5")),
    }
    config_path = WORKDIR / "config.yaml"
    if config_path.exists():
        with config_path.open(encoding="utf-8") as handle:
            file_config = yaml.safe_load(handle) or {}
        if isinstance(file_config, dict):
            # env already-set values win; fill the rest from file
            for key, value in file_config.items():
                config.setdefault(key, value)
    return config


CONFIG = load_config()
client = Anthropic(base_url=os.getenv("ANTHROPIC_BASE_URL"))

# ---------------------------------------------------------------------------
# Tool Registry
# ---------------------------------------------------------------------------


@dataclass
class Tool:
    """One action the agent can take. Side effect and permission are explicit."""

    name: str
    description: str
    input_schema: dict
    handler: Callable[..., str]
    permission: str = "allow"  # allow | ask | deny


def _require_string(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    return value


def _validate_input(tool: Tool, args: dict) -> dict:
    """Validate tool input against its JSON schema (required fields + types)."""
    props = tool.input_schema.get("properties", {})
    required = tool.input_schema.get("required", [])
    for field_name in required:
        if field_name not in args:
            raise ValueError(f"Missing required field: {field_name}")
    for key, value in args.items():
        spec = props.get(key, {})
        expected = spec.get("type")
        if expected == "string":
            _require_string(value, key)
        elif expected == "integer" and not isinstance(value, int):
            raise ValueError(f"{key} must be an integer")
        elif expected == "number" and not isinstance(value, (int, float)):
            raise ValueError(f"{key} must be a number")
        elif expected == "boolean" and not isinstance(value, bool):
            raise ValueError(f"{key} must be a boolean")
    return args


# -- Domain tools: replace these with your product's tools -------------------
# Each entry: name -> (description, input_schema, handler, permission)


def _tool_read(path: str, limit: int | None = None) -> str:
    safe = safe_path(path)
    try:
        text = safe.read_text(encoding="utf-8")
        lines = text.splitlines()
        if limit is not None:
            lines = lines[:limit]
        return "\n".join(lines)
    except Exception as exc:  # noqa: BLE001
        return f"Error: {type(exc).__name__}: {exc}"


def _tool_write(path: str, content: str) -> str:
    safe = safe_path(path)
    try:
        safe.parent.mkdir(parents=True, exist_ok=True)
        safe.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} bytes to {path}"
    except Exception as exc:  # noqa: BLE001
        return f"Error: {type(exc).__name__}: {exc}"


def safe_path(path: str, base: Path | None = None) -> Path:
    """Resolve a path and refuse to escape the workspace (fail closed)."""
    base = (base or WORKDIR).resolve()
    resolved = (base / path).resolve()
    if not resolved.is_relative_to(base):
        raise ValueError(f"Path escapes workspace: {path}")
    return resolved


TOOL_SPECS: dict[str, Tool] = {
    "read_file": Tool(
        name="read_file",
        description="Read a text file's contents.",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["path"],
        },
        handler=_tool_read,
        permission="allow",
    ),
    "write_file": Tool(
        name="write_file",
        description="Write content to a file, creating parents as needed.",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
        handler=_tool_write,
        permission="ask",
    ),
}

TOOL_DEFS = [
    {
        "name": tool.name,
        "description": tool.description,
        "input_schema": tool.input_schema,
    }
    for tool in TOOL_SPECS.values()
]

# ---------------------------------------------------------------------------
# Permission checkpoint
# ---------------------------------------------------------------------------


def permission_check(tool: Tool, args: dict) -> str:
    """Return "allow", "ask", or "deny" for a tool call.

    Override this function with your product's permission rules (see s03).
    The default is conservative: anything marked "ask" requires human consent.
    """
    if tool.permission == "deny":
        return "deny"
    if tool.permission == "ask":
        answer = input(f"  [permission] Allow {tool.name}({str(args)[:80]})? [y/N] ")
        return "allow" if answer.strip().lower() in {"y", "yes"} else "deny"
    return "allow"


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------


SYSTEM_PROMPT = f"""You are a coding agent working in {WORKDIR}.

Rules:
- Prefer action over explanation.
- Never invent file paths; read first if unsure.
- After finishing, summarize what changed.

Tools: read_file, write_file.
"""


# ---------------------------------------------------------------------------
# Model call with retry
# ---------------------------------------------------------------------------


def _backoff(attempt: int) -> float:
    return CONFIG["base_delay_seconds"] * (2 ** attempt)


def call_model(messages: list[dict]) -> Any:
    """Call the model with retry on transient errors and timeout."""
    last_error: Exception | None = None
    for attempt in range(CONFIG["max_retries"]):
        try:
            return client.messages.create(
                model=CONFIG["model"],
                system=SYSTEM_PROMPT,
                messages=messages,
                tools=TOOL_DEFS,
                max_tokens=CONFIG["max_tokens"],
                timeout=CONFIG["timeout_seconds"],
            )
        except (APITimeoutError, APIConnectionError, APIStatusError) as exc:
            last_error = exc
            delay = _backoff(attempt)
            LOG.warning("model call failed (attempt %d/%d): %s; retry in %.1fs",
                        attempt + 1, CONFIG["max_retries"], exc, delay)
            time.sleep(delay)
    raise RuntimeError(f"Model call failed after {CONFIG['max_retries']} attempts: {last_error}")


# ---------------------------------------------------------------------------
# Trajectory capture
# ---------------------------------------------------------------------------


def record_trajectory(entry: dict) -> None:
    """Append one step to the trajectory log (training signal for the future)."""
    try:
        TRAJECTORY_DIR.mkdir(parents=True, exist_ok=True)
        path = TRAJECTORY_DIR / f"trajectory-{time.strftime('%Y%m%d')}.jsonl"
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=True) + "\n")
    except Exception as exc:  # noqa: BLE001
        LOG.warning("failed to record trajectory: %s", exc)


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------


def agent_loop(prompt: str, history: list[dict] | None = None) -> str:
    history = history if history is not None else []
    history.append({"role": "user", "content": prompt})

    while True:
        response = call_model(history)
        history.append({"role": "assistant", "content": response.content})

        tool_calls = [b for b in response.content if getattr(b, "type", None) == "tool_use"]
        if not tool_calls:
            return "".join(
                b.text for b in response.content if getattr(b, "type", None) == "text"
            )

        results = []
        for block in tool_calls:
            tool = TOOL_SPECS.get(block.name)
            if tool is None:
                output = f"Unknown tool: {block.name}"
            else:
                try:
                    args = _validate_input(tool, dict(block.input))
                    decision = permission_check(tool, args)
                    if decision == "deny":
                        output = f"Permission denied for {tool.name}"
                    else:
                        output = tool.handler(**args)
                except Exception as exc:  # noqa: BLE001
                    output = f"Error: {type(exc).__name__}: {exc}"
                record_trajectory({
                    "ts": time.time(),
                    "tool": block.name,
                    "input": block.input,
                    "output": output[:1000],
                })
            LOG.info("tool=%s output=%s", block.name, output[:120])
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": output,
            })

        history.append({"role": "user", "content": results})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _shutdown(signum, _frame):
    LOG.info("received signal %s, shutting down", signum)
    sys.exit(128 + signum)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    LOG.info("production agent skeleton started; model=%s workdir=%s",
             CONFIG["model"], WORKDIR)
    print(f"Agent ready. Model: {CONFIG['model']}. Type 'q' to quit.\n")

    history: list[dict] = []
    while True:
        try:
            query = input(">> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if query in {"q", "quit", "exit", ""}:
            break
        try:
            print(agent_loop(query, history))
        except Exception as exc:  # noqa: BLE001
            LOG.error("agent loop failed: %s", exc)
            print(f"Error: {exc}")
        print()


if __name__ == "__main__":
    main()
