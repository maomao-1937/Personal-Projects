import importlib.util
import os
import sys
import tempfile
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "s10_task_system" / "code.py"


def load_component(workdir: Path):
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

    module_name = f"s10_task_system_test_{id(workdir)}"
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
        sys.modules.pop(module_name, None)
        if previous_model is None:
            os.environ.pop("MODEL_ID", None)
        else:
            os.environ["MODEL_ID"] = previous_model
        for name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous


def tool_call(name: str, **arguments):
    return types.SimpleNamespace(name=name, input=arguments, id="tool-1")


def test_s10_keeps_the_s04_kernel_and_adds_task_tools() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        component = load_component(workdir)

        assert [tool["name"] for tool in component.TOOLS] == [
            "bash",
            "read_file",
            "write_file",
            "edit_file",
            "glob",
            "create_task",
            "list_tasks",
            "get_task",
            "claim_task",
            "complete_task",
        ]
        assert component.permission_hook in component.HOOKS["PreToolUse"]
        assert hasattr(component, "execute_tool")
        assert not hasattr(component, "MEMORY_DIR")
        assert not (workdir / ".tasks").exists()


def test_dependencies_gate_claim_and_completion_checks_owner() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        component = load_component(workdir)

        schema = component.create_task("create schema")
        api = component.create_task("write API", blockedBy=[schema.id])

        assert component.claim_task(api.id) == f"Blocked by: ['{schema.id}']"
        assert "Claimed" in component.claim_task(schema.id)
        assert "Unblocked: write API" in component.complete_task(schema.id)
        assert "Claimed" in component.claim_task(api.id)
        assert "owned by agent, not other" in component.complete_task(
            api.id, owner="other"
        )
        assert "Completed" in component.complete_task(api.id)
        assert component.load_task(api.id).status == "completed"


def test_invalid_and_missing_task_ids_become_tool_results() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))

        invalid = component.execute_tool(tool_call("get_task", task_id="../outside"))
        missing = component.execute_tool(
            tool_call("claim_task", task_id="task_00000000")
        )

        assert invalid.startswith("Error: Invalid task ID")
        assert missing.startswith("Error:")


def test_create_retries_instead_of_overwriting_an_existing_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        values = iter(["deadbeef", "deadbeef", "cafebabe"])
        monkeypatch.setattr(component.secrets, "token_hex", lambda _size: next(values))

        first = component.create_task("first")
        second = component.create_task("second")

        assert first.id == "task_deadbeef"
        assert second.id == "task_cafebabe"
        assert [task.subject for task in component.list_tasks()] == ["second", "first"]


def test_create_rejects_unknown_dependencies() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))

        output = component.execute_tool(tool_call(
            "create_task",
            subject="write API",
            blockedBy=["task_00000000"],
        ))

        assert output == "Error: Dependency not found: task_00000000"


def test_task_store_rejects_a_symlink_outside_the_workspace() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        with tempfile.TemporaryDirectory() as outside:
            workdir = Path(tmp)
            (workdir / ".tasks").symlink_to(
                Path(outside), target_is_directory=True
            )
            component = load_component(workdir)

            output = component.execute_tool(
                tool_call("create_task", subject="unsafe")
            )

            assert output == "Error: Task store escapes the workspace"
            assert list(Path(outside).iterdir()) == []
