import importlib.util
import os
import sys
import tempfile
import time
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "scaffold" / "agent.py"


def load_component(workdir: Path):
    fake_anthropic = types.ModuleType("anthropic")
    fake_dotenv = types.ModuleType("dotenv")

    class FakeAnthropic:
        def __init__(self, *args, **kwargs):
            self.messages = types.SimpleNamespace(create=None)

    fake_anthropic.Anthropic = FakeAnthropic
    fake_anthropic.APIStatusError = type("APIStatusError", (Exception,), {})
    fake_anthropic.APITimeoutError = type("APITimeoutError", (Exception,), {})
    fake_anthropic.APIConnectionError = type(
        "APIConnectionError", (Exception,), {}
    )
    fake_dotenv.load_dotenv = lambda override=True: None

    previous_modules = {
        "anthropic": sys.modules.get("anthropic"),
        "dotenv": sys.modules.get("dotenv"),
    }
    previous_cwd = Path.cwd()
    previous_env = {
        key: os.environ.get(key)
        for key in ("MODEL_ID", "MAX_TOKENS", "TIMEOUT_SECONDS", "MAX_RETRIES")
    }
    module_name = f"scaffold_test_{time.time_ns()}"
    spec = importlib.util.spec_from_file_location(module_name, COMPONENT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)

    sys.modules["anthropic"] = fake_anthropic
    sys.modules["dotenv"] = fake_dotenv
    sys.modules[module_name] = module
    try:
        os.chdir(workdir)
        os.environ["MODEL_ID"] = "test-model"
        spec.loader.exec_module(module)
        return module
    finally:
        os.chdir(previous_cwd)
        for key, value in previous_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
        sys.modules.pop(module_name, None)


def test_safe_path_rejects_escape() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        with pytest.raises(ValueError, match="escapes workspace"):
            component.safe_path("../outside.txt")
        with pytest.raises(ValueError, match="escapes workspace"):
            component.safe_path("/etc/passwd")


def test_safe_path_allows_workspace_relative() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        resolved = component.safe_path("sub/file.txt")
        assert resolved == (Path(tmp) / "sub" / "file.txt").resolve()


def test_validate_input_enforces_required_and_types() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        read_tool = component.TOOL_SPECS["read_file"]

        with pytest.raises(ValueError, match="Missing required field"):
            component._validate_input(read_tool, {})
        with pytest.raises(ValueError, match="must be a string"):
            component._validate_input(read_tool, {"path": 123})

        args = component._validate_input(read_tool, {"path": "f.txt", "limit": 5})
        assert args == {"path": "f.txt", "limit": 5}


def test_tool_read_and_write_roundtrip() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        result = component._tool_write("note.txt", "hello\nworld\n")
        assert "Wrote" in result

        assert component._tool_read("note.txt") == "hello\nworld"
        assert component._tool_read("note.txt", limit=1) == "hello"


def test_tool_specs_declare_permissions() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        assert component.TOOL_SPECS["read_file"].permission == "allow"
        assert component.TOOL_SPECS["write_file"].permission == "ask"
        assert component.TOOL_SPECS["write_file"].input_schema["required"] == [
            "path", "content"
        ]


def test_agent_loop_returns_text_when_no_tool_calls() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))

        def respond(**kwargs):
            return types.SimpleNamespace(
                content=[types.SimpleNamespace(type="text", text="Hello!")]
            )

        component.client.messages.create = respond
        assert component.agent_loop("hi") == "Hello!"


def test_agent_loop_executes_a_tool_call() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        (Path(tmp) / "f.txt").write_text("file content")

        responses = [
            types.SimpleNamespace(
                content=[
                    types.SimpleNamespace(
                        type="tool_use",
                        id="tool-1",
                        name="read_file",
                        input={"path": "f.txt"},
                    )
                ]
            ),
            types.SimpleNamespace(
                content=[types.SimpleNamespace(type="text", text="Read it.")]
            ),
        ]

        def respond(**kwargs):
            return responses.pop(0)

        component.client.messages.create = respond
        assert component.agent_loop("read f.txt") == "Read it."
