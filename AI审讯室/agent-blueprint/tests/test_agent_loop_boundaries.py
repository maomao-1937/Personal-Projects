import importlib.util
import os
import sys
import tempfile
import time
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = tuple(
    ROOT / chapter / "code.py"
    for chapter in (
        "s01_agent_loop",
        "s02_tool_use",
        "s03_permission",
        "s04_hooks",
        "s05_todo_write",
        "s06_subagent",
        "s07_skill_loading",
        "s08_context_compact",
        "s09_memory",
        "s10_task_system",
        "s11_background_tasks",
        "s12_cron_scheduler",
        "s13_agent_teams",
        "s14_mcp_plugin",
    )
)
INTEGRATED_COMPONENT = ROOT / "s15_integrated_harness" / "code.py"


class FakeMessagesApi:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def create(self, **_kwargs):
        self.calls += 1
        if not self.responses:
            raise AssertionError("agent loop requested another model turn")
        return self.responses.pop(0)


def load_component(workdir: Path, component_path: Path):
    fake_anthropic = types.ModuleType("anthropic")
    fake_dotenv = types.ModuleType("dotenv")

    class FakeAnthropic:
        def __init__(self, *args, **kwargs):
            self.messages = FakeMessagesApi([])

    fake_anthropic.Anthropic = FakeAnthropic
    fake_dotenv.load_dotenv = lambda override=True: None

    previous_modules = {
        "anthropic": sys.modules.get("anthropic"),
        "dotenv": sys.modules.get("dotenv"),
    }
    previous_cwd = Path.cwd()
    previous_model = os.environ.get("MODEL_ID")
    module_name = f"agent_loop_boundary_{component_path.parent.name}_{time.time_ns()}"
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


def empty_tool_use_response(content=None):
    return types.SimpleNamespace(
        stop_reason="tool_use",
        content=(
            [types.SimpleNamespace(type="text", text="")]
            if content is None else content
        ),
    )


def disable_component_side_effects(component):
    if hasattr(component, "trigger_hooks"):
        component.trigger_hooks = lambda *_args, **_kwargs: None
    if hasattr(component, "inject_background_results"):
        component.inject_background_results = lambda _messages: None
    if hasattr(component, "consume_cron_queue"):
        component.consume_cron_queue = lambda: []
    if hasattr(component, "extract_memories"):
        component.extract_memories = lambda _messages: False
    if hasattr(component, "release_completed_assignment"):
        component.release_completed_assignment = lambda _owner: None
    if hasattr(component, "assemble_tool_pool"):
        component.assemble_tool_pool = lambda: ([], {})
    if hasattr(component, "assemble_system_prompt"):
        component.assemble_system_prompt = lambda: "test system"
    if hasattr(component, "COMPACTOR"):
        component.COMPACTOR.prepare = lambda messages, _request: messages


def use_successful_bash_handler(component):
    if hasattr(component, "run_bash"):
        component.run_bash = lambda *_args, **_kwargs: "tool output"
    if hasattr(component, "check_permission"):
        component.check_permission = lambda _block: True
    if hasattr(component, "execute_tool"):
        component.execute_tool = lambda *_args, **_kwargs: "tool output"
    if hasattr(component, "TOOL_HANDLERS"):
        component.TOOL_HANDLERS["bash"] = lambda **_kwargs: "tool output"


def bash_tool_call():
    return types.SimpleNamespace(
        type="tool_use",
        id="tool_1",
        name="bash",
        input={"command": "true"},
    )


@pytest.mark.parametrize("component_path", COMPONENTS, ids=lambda path: path.parent.name)
@pytest.mark.parametrize("content", ([], None), ids=("empty-content", "empty-text"))
def test_parent_loop_does_not_append_an_empty_tool_result_turn(
        component_path: Path, content):
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), component_path)
        disable_component_side_effects(component)
        api = FakeMessagesApi([empty_tool_use_response(content)])
        component.client = types.SimpleNamespace(messages=api)
        messages = [{"role": "user", "content": "hello"}]

        if component_path.parent.name == "s08_context_compact":
            component.agent_loop(messages, "hello")
        else:
            component.agent_loop(messages)

        assert api.calls == 1
        assert messages[-1]["role"] == "assistant"
        assert not any(
            message.get("role") == "user" and message.get("content") == []
            for message in messages
        )


@pytest.mark.parametrize("component_path", COMPONENTS, ids=lambda path: path.parent.name)
def test_parent_loop_executes_a_real_tool_call_even_if_stop_reason_disagrees(
        component_path: Path):
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), component_path)
        disable_component_side_effects(component)
        use_successful_bash_handler(component)
        api = FakeMessagesApi([
            types.SimpleNamespace(
                stop_reason="end_turn",
                content=[bash_tool_call()],
            ),
            types.SimpleNamespace(
                stop_reason="end_turn",
                content=[types.SimpleNamespace(type="text", text="done")],
            ),
        ])
        component.client = types.SimpleNamespace(messages=api)
        messages = [{"role": "user", "content": "hello"}]

        if component_path.parent.name == "s08_context_compact":
            component.agent_loop(messages, "hello")
        else:
            component.agent_loop(messages)

        assert api.calls == 2
        tool_result_turns = [
            message for message in messages
            if message.get("role") == "user"
            and isinstance(message.get("content"), list)
        ]
        assert len(tool_result_turns) == 1
        assert tool_result_turns[0]["content"][0]["tool_use_id"] == "tool_1"


def test_subagent_stops_without_an_empty_tool_result_turn():
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), ROOT / "s06_subagent" / "code.py")
        disable_component_side_effects(component)
        api = FakeMessagesApi([empty_tool_use_response()])
        component.client = types.SimpleNamespace(messages=api)

        assert component.run_subagent("inspect the repository") == "(no summary)"
        assert api.calls == 1


def test_subagent_still_executes_a_real_tool_call_with_text_present():
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), ROOT / "s06_subagent" / "code.py")
        disable_component_side_effects(component)
        tool_call = types.SimpleNamespace(
            type="tool_use",
            id="tool_1",
            name="read_file",
            input={"path": "README.md"},
        )
        api = FakeMessagesApi([
            types.SimpleNamespace(
                stop_reason="end_turn",
                content=[types.SimpleNamespace(type="text", text=""), tool_call],
            ),
            types.SimpleNamespace(
                stop_reason="end_turn",
                content=[types.SimpleNamespace(type="text", text="done")],
            ),
        ])
        component.client = types.SimpleNamespace(messages=api)
        component.execute_tool = lambda _block, _handlers: "tool output"

        assert component.run_subagent("inspect the repository") == "done"
        assert api.calls == 2


def test_s13_teammate_does_not_continue_with_an_empty_tool_result_turn():
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), ROOT / "s13_agent_teams" / "code.py")
        api = FakeMessagesApi([empty_tool_use_response()])
        component.client = types.SimpleNamespace(messages=api)
        runtime = component.TeammateRuntime(
            "alice", "reviewer", "inspect the repository", None, False
        )

        assert runtime.work() == "idle"
        assert api.calls == 1
        assert not any(
            message.get("role") == "user" and message.get("content") == []
            for message in runtime.messages
        )


def test_s13_teammate_executes_a_real_tool_call_when_stop_reason_disagrees():
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), ROOT / "s13_agent_teams" / "code.py")
        api = FakeMessagesApi([
            types.SimpleNamespace(
                stop_reason="end_turn",
                content=[bash_tool_call()],
            )
        ])
        component.client = types.SimpleNamespace(messages=api)
        component._run_teammate_tool = lambda *_args: "tool output"
        runtime = component.TeammateRuntime(
            "alice", "reviewer", "inspect the repository", None, False
        )

        assert runtime.work() == "continue"
        assert api.calls == 1
        assert runtime.messages[-1]["content"][0]["tool_use_id"] == "tool_1"


def stop_s15_teammate_when_idle(component, name: str):
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        with component.team_lock:
            state = component.active_teammates.get(name)
        if state == "idle":
            component.run_request_shutdown(name)
            break
        if state is None:
            break
        time.sleep(0.01)

    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        with component.team_lock:
            if name not in component.active_teammates:
                return
        time.sleep(0.01)


def test_s15_teammate_does_not_request_another_turn_for_empty_tool_use():
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), INTEGRATED_COMPONENT)
        api = FakeMessagesApi([empty_tool_use_response()])
        component.client = types.SimpleNamespace(messages=api)

        component.spawn_teammate_thread("alice", "reviewer", "inspect the repository")
        stop_s15_teammate_when_idle(component, "alice")

        assert api.calls == 1
        with component.team_lock:
            assert "alice" not in component.active_teammates


def test_s15_teammate_executes_a_real_tool_call_when_stop_reason_disagrees():
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp), INTEGRATED_COMPONENT)
        api = FakeMessagesApi([
            types.SimpleNamespace(
                stop_reason="end_turn",
                content=[bash_tool_call()],
            ),
            types.SimpleNamespace(
                stop_reason="end_turn",
                content=[types.SimpleNamespace(type="text", text="done")],
            ),
        ])
        component.client = types.SimpleNamespace(messages=api)
        calls = []
        component._run_teammate_tool = lambda *_args: calls.append("bash") or "ok"

        component.spawn_teammate_thread("alice", "reviewer", "inspect the repository")
        stop_s15_teammate_when_idle(component, "alice")

        assert api.calls == 2
        assert calls == ["bash"]
        with component.team_lock:
            assert "alice" not in component.active_teammates
