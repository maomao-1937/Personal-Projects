import importlib.util
import os
import sys
import tempfile
import time
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "s14_mcp_plugin" / "code.py"


def load_component(workdir: Path, component_path: Path = COMPONENT):
    fake_anthropic = types.ModuleType("anthropic")
    fake_dotenv = types.ModuleType("dotenv")

    class FakeAnthropic:
        def __init__(self, *args, **kwargs):
            self.messages = types.SimpleNamespace(create=None)

    fake_anthropic.Anthropic = FakeAnthropic
    fake_dotenv.load_dotenv = lambda override=True: None

    previous_modules = {
        "anthropic": sys.modules.get("anthropic"),
        "dotenv": sys.modules.get("dotenv"),
    }
    previous_cwd = Path.cwd()
    previous_model = os.environ.get("MODEL_ID")
    module_name = f"mcp_plugin_test_{time.time_ns()}"
    spec = importlib.util.spec_from_file_location(module_name, component_path)
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
        if previous_model is None:
            os.environ.pop("MODEL_ID", None)
        else:
            os.environ["MODEL_ID"] = previous_model
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
        sys.modules.pop(module_name, None)


def test_normalize_mcp_name() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        assert component.normalize_mcp_name("my.server") == "my_server"
        assert component.normalize_mcp_name("a b/c") == "a_b_c"
        with pytest.raises(ValueError):
            component.normalize_mcp_name("")


def test_mcp_client_register_rejects_duplicate_and_missing_handler() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        client = component.MCPClient("test")

        with pytest.raises(ValueError, match="non-empty"):
            client.register([{"name": ""}], {})

        with pytest.raises(ValueError, match="Duplicate"):
            client.register(
                [{"name": "a"}, {"name": "a"}],
                {"a": lambda: "x"},
            )

        with pytest.raises(ValueError, match="Missing MCP handlers"):
            client.register([{"name": "a"}], {})

        client.register([{"name": "a"}], {"a": lambda: "x"})
        assert client.tools == [{"name": "a"}]


def test_mcp_client_call_tool_returns_errors() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        client = component.MCPClient("test")
        client.register([{"name": "boom"}], {"boom": lambda: 1 / 0})

        assert "unknown tool" in client.call_tool("nope", {})
        assert "ZeroDivisionError" in client.call_tool("boom", {})


def test_connect_mcp_reports_discovered_tools_and_prevents_duplicate() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        result = component.connect_mcp("docs")
        assert "Connected" in result
        assert "2 tools" in result
        assert "search" in result

        assert "already connected" in component.connect_mcp("docs")
        assert "Unknown server" in component.connect_mcp("nope")


def test_assemble_tool_pool_prefixes_and_applies_policy() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        component.connect_mcp("docs")
        component.connect_mcp("deploy")

        tools, handlers = component.assemble_tool_pool()
        names = [tool["name"] for tool in tools]
        assert "mcp__docs__search" in names
        assert "mcp__docs__get_version" in names
        assert "mcp__deploy__status" in names
        assert "mcp__deploy__trigger" in names
        assert "connect_mcp" in names

        assert handlers["mcp__docs__search"](query="x") == (
            "[docs] Found 3 results for 'x'"
        )
        assert handlers["mcp__deploy__status"](service="web") == (
            "[deploy] web: running (v1.4.2)"
        )

        assert component.mcp_tool_policies["mcp__docs__search"] == "allow"
        assert component.mcp_tool_policies["mcp__deploy__trigger"] == "confirm"


def test_assemble_tool_pool_detects_normalization_collision() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))

        server_a = component.MCPClient("docs.one")
        server_a.register(
            [{"name": "get/version", "inputSchema": {"type": "object"}}],
            {"get/version": lambda: "v1"},
        )
        server_b = component.MCPClient("docs_one")
        server_b.register(
            [{"name": "get_version", "inputSchema": {"type": "object"}}],
            {"get_version": lambda: "v2"},
        )
        component.mcp_clients["docs.one"] = server_a
        component.mcp_clients["docs_one"] = server_b

        with pytest.raises(ValueError, match="collision"):
            component.assemble_tool_pool()


def test_assemble_system_prompt_lists_connected_servers() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        assert "Connected MCP servers" not in component.assemble_system_prompt()
        component.connect_mcp("docs")
        assert "Connected MCP servers: docs" in component.assemble_system_prompt()


def test_permission_hook_allows_configured_readonly_mcp_tool() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        component.connect_mcp("docs")
        component.assemble_tool_pool()

        block = types.SimpleNamespace(
            name="mcp__docs__search",
            input={"query": "x"},
            type="tool_use",
        )
        assert component.permission_hook(block) is None


def test_permission_hook_denies_unconfirmed_external_tool(monkeypatch) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        component.connect_mcp("deploy")
        component.assemble_tool_pool()

        monkeypatch.setattr("builtins.input", lambda _: "n")
        block = types.SimpleNamespace(
            name="mcp__deploy__trigger",
            input={"service": "web"},
            type="tool_use",
        )
        assert component.permission_hook(block) == "Permission denied by user"


def test_s15_integrated_harness_discovers_and_dispatches_mcp_tools(
    tmp_path: Path,
) -> None:
    component = load_component(
        tmp_path, ROOT / "s15_integrated_harness" / "code.py"
    )

    _, handlers_before = component.assemble_tool_pool()
    assert "mcp__deploy__status" not in handlers_before
    assert "Connected to MCP server 'deploy'" in component.connect_mcp("deploy")

    tools_after, handlers_after = component.assemble_tool_pool()
    assert "mcp__deploy__status" in {tool["name"] for tool in tools_after}
    assert handlers_after["mcp__deploy__status"](service="web") == (
        "[deploy] web: running (v1.4.2)"
    )
