import importlib.util
import multiprocessing
import os
import shlex
import subprocess
import sys
import tempfile
import threading
import time
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "s13_agent_teams" / "code.py"
DOWNSTREAM_COMPONENTS = (
    ROOT / "s15_integrated_harness" / "code.py",
)
RUNTIME_COMPONENTS = (COMPONENT, *DOWNSTREAM_COMPONENTS)
MCP_COMPONENTS = (
    ROOT / "s14_mcp_plugin" / "code.py",
    ROOT / "s15_integrated_harness" / "code.py",
)
BACKGROUND_COMPONENTS = tuple(
    ROOT / name / "code.py" for name in (
        "s11_background_tasks",
        "s15_integrated_harness",
    )
)
CRON_COMPONENTS = tuple(
    ROOT / name / "code.py" for name in (
        "s12_cron_scheduler",
        "s15_integrated_harness",
    )
)


def load_component(temp_cwd: Path, component_path: Path = COMPONENT):
    fake_anthropic = types.ModuleType("anthropic")
    fake_yaml = types.ModuleType("yaml")

    class FakeAnthropic:
        def __init__(self, *args, **kwargs):
            self.messages = types.SimpleNamespace(create=None)

    fake_dotenv = types.ModuleType("dotenv")
    setattr(fake_anthropic, "Anthropic", FakeAnthropic)
    setattr(fake_dotenv, "load_dotenv", lambda override=True: None)
    setattr(fake_yaml, "safe_load", lambda value: {})
    setattr(fake_yaml, "YAMLError", ValueError)

    previous_modules = {
        "anthropic": sys.modules.get("anthropic"),
        "dotenv": sys.modules.get("dotenv"),
        "yaml": sys.modules.get("yaml"),
    }
    previous_cwd = Path.cwd()
    previous_model = os.environ.get("MODEL_ID")

    name = f"agent_teams_test_{component_path.parent.name}_{time.time_ns()}"
    spec = importlib.util.spec_from_file_location(name, component_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {component_path}")
    module = importlib.util.module_from_spec(spec)

    sys.modules["anthropic"] = fake_anthropic
    sys.modules["dotenv"] = fake_dotenv
    sys.modules["yaml"] = fake_yaml
    sys.modules[name] = module
    try:
        os.chdir(temp_cwd)
        os.environ["MODEL_ID"] = "test-model"
        spec.loader.exec_module(module)
        return module
    finally:
        os.chdir(previous_cwd)
        if previous_model is None:
            os.environ.pop("MODEL_ID", None)
        else:
            os.environ["MODEL_ID"] = previous_model
        for module_name, previous in previous_modules.items():
            if previous is None:
                sys.modules.pop(module_name, None)
            else:
                sys.modules[module_name] = previous


def wait_until(predicate, timeout=2.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


def init_git_repo(root: Path):
    subprocess.run(
        ["git", "init", "-q", "-b", "main"], cwd=root, check=True
    )
    subprocess.run(
        ["git", "config", "user.email", "tests@example.com"],
        cwd=root, check=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Runtime Tests"],
        cwd=root, check=True,
    )
    (root / "tracked.txt").write_text("initial\n")
    subprocess.run(["git", "add", "tracked.txt"], cwd=root, check=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", "initial"], cwd=root, check=True
    )


def claim_in_child(component_path: str, root: str, task_id: str, owner: str,
                   barrier, results):
    component = load_component(Path(root), Path(component_path))
    barrier.wait()
    results.put(component.claim_task(task_id, owner=owner))


class AgentTeamsRuntimeTests(unittest.TestCase):
    def test_downstream_components_execute_the_merged_runtime_contract(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    task = component.create_task("Runtime contract")
                    self.assertIn(
                        "Claimed", component.claim_task(task.id, owner="alice")
                    )
                    self.assertIn(
                        "Completed", component.complete_task(task.id, owner="alice")
                    )
                    self.assertIn("alice", component.teammate_assignments)
                    self.assertTrue(component.release_completed_assignment("alice"))
                    self.assertNotIn("alice", component.teammate_assignments)

    def test_inbox_delivery_is_runtime_owned(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))

            tool_names = {tool["name"] for tool in component.TOOLS}
            self.assertNotIn("check_inbox", tool_names)
            self.assertIn("create_worktree", tool_names)
            self.assertNotIn("remove_worktree", tool_names)
            self.assertNotIn("keep_worktree", tool_names)
            worktree_tools = {
                tool["name"]: tool["input_schema"] for tool in component.TOOLS
                if tool["name"] == "create_worktree"
            }
            for schema in worktree_tools.values():
                self.assertFalse(schema["additionalProperties"])
                self.assertEqual(schema["properties"]["name"]["maxLength"], 64)
            self.assertIn("wait for the user's confirmation",
                          component.PROMPT_SECTIONS["teams"])
            self.assertIn("creating a Task", component.PROMPT_SECTIONS["teams"])
            self.assertIn("not a sandbox", component.PROMPT_SECTIONS["teams"])

            component.BUS.send("alice", "lead", "done", "result")
            events = component.consume_lead_inbox()

            self.assertEqual([event["type"] for event in events], ["result"])
            self.assertIn("[result] alice: done",
                          component.format_team_events(events))

    def test_spawn_claims_the_initial_task_before_starting_the_thread(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            task = component.create_task("Review authentication")
            schema = next(
                tool["input_schema"] for tool in component.TOOLS
                if tool["name"] == "spawn_teammate"
            )
            self.assertIn("task_id", schema["properties"])

            with patch.object(
                component.threading.Thread, "start", lambda _thread: None
            ):
                result = component.spawn_teammate_thread(
                    "alice", "reviewer", "Review the assigned Task.", task.id
                )

            self.assertIn(task.id, result)
            claimed = component.load_task(task.id)
            self.assertEqual(claimed.status, "in_progress")
            self.assertEqual(claimed.owner, "alice")
            self.assertEqual(
                component.teammate_assignments["alice"]["task_id"], task.id
            )

    def test_spawn_allows_an_idle_teammate_without_an_initial_task(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    tool_defs = getattr(component, "TOOLS", None)
                    if tool_defs is None:
                        tool_defs = component.BUILTIN_TOOLS
                    schema = next(
                        tool["input_schema"] for tool in tool_defs
                        if tool["name"] == "spawn_teammate"
                    )
                    self.assertNotIn("task_id", schema["required"])

                    with patch.object(
                        component.threading.Thread, "start", lambda _thread: None
                    ):
                        result = component.run_spawn_teammate(
                            "alice", "reviewer", "Wait for a ready Task."
                        )

                    self.assertIn("without an initial Task", result)
                    self.assertNotIn("alice", component.teammate_assignments)

    def test_teammate_workspace_tools_require_a_claimed_task(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            component = load_component(root)
            runtime = component.TeammateRuntime(
                "alice", "reviewer", "Inspect the project.", None, False
            )

            result = runtime.write("unassigned.txt", "must not be written")

            self.assertIn("Claim a Task", result)
            self.assertFalse((root / "unassigned.txt").exists())

    def test_plain_message_does_not_change_assignment_or_plan_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.active_teammates["alice"] = "working"
            component.plan_gates["alice"] = "approved"
            component.assignment_versions["alice"] = 3

            self.assertIn("Sent", component.run_send_message("alice", "Continue."))

            self.assertEqual(component.plan_gates["alice"], "approved")
            self.assertEqual(component.assignment_versions["alice"], 3)

    def test_worktree_removal_is_host_only(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    tool_defs = getattr(component, "TOOLS", None)
                    if tool_defs is None:
                        tool_defs = component.BUILTIN_TOOLS
                    self.assertNotIn(
                        "remove_worktree",
                        {tool["name"] for tool in tool_defs},
                    )
                    self.assertTrue(callable(component.remove_worktree))
                    self.assertFalse(hasattr(component, "run_remove_worktree"))

    def test_agent_teams_builds_on_tasks_not_background_or_cron(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            component = load_component(root)
            tool_names = {tool["name"] for tool in component.TOOLS}

            self.assertTrue({
                "bash", "read_file", "write_file", "edit_file", "glob",
                "create_task", "list_tasks", "get_task", "claim_task",
                "complete_task", "spawn_teammate", "list_teammates",
                "send_message", "request_shutdown", "request_plan",
                "review_plan", "create_worktree",
            }.issubset(tool_names))
            self.assertTrue({
                "schedule_cron", "list_crons", "cancel_cron",
            }.isdisjoint(tool_names))
            self.assertNotIn("run_in_background", next(
                tool["input_schema"] for tool in component.TOOLS
                if tool["name"] == "bash"
            )["properties"])
            self.assertFalse((root / ".tasks").exists())
            self.assertFalse((root / ".mailboxes").exists())
            self.assertFalse((root / ".worktrees").exists())

    def test_integrated_harness_reuses_memory_recall_and_extraction(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp), DOWNSTREAM_COMPONENTS[0])
            calls = []
            component.MEMORY_RUNTIME = types.SimpleNamespace(
                read_memory_index=lambda: "- [Style](style.md) - Project style",
                load_memories=lambda messages: (
                    calls.append(("recall", list(messages)))
                    or '[{"source":"style.md","content":"Use black."}]'
                ),
                extract_memories=lambda messages: (
                    calls.append(("extract", list(messages))) or 1
                ),
                consolidate_memories=lambda: calls.append(("consolidate", None)),
            )
            messages = [{"role": "user", "content": "Format this file."}]

            context = component.update_context({}, messages)
            system = component.assemble_system_prompt(context)
            component.remember_after_turn(messages)

            self.assertIn("Memory catalog", system)
            self.assertIn("Relevant memory records", system)
            self.assertEqual(
                [name for name, _payload in calls],
                ["recall", "extract", "consolidate"],
            )

    def test_mcp_component_builds_on_the_base_kernel(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s14_mcp_plugin" / "code.py"
            )
            tools_before, handlers_before = component.assemble_tool_pool()
            self.assertEqual(
                {tool["name"] for tool in tools_before},
                {"bash", "read_file", "write_file", "edit_file", "glob",
                 "connect_mcp"},
            )
            self.assertNotIn("mcp__docs__search", handlers_before)

            self.assertIn(
                "Connected to MCP server 'docs'", component.connect_mcp("docs")
            )
            tools_after, handlers_after = component.assemble_tool_pool()
            self.assertIn(
                "mcp__docs__search",
                {tool["name"] for tool in tools_after},
            )
            self.assertEqual(
                handlers_after["mcp__docs__search"](query="hooks"),
                "[docs] Found 3 results for 'hooks'",
            )

    def test_background_dispatch_is_bash_only_and_reports_failures(self):
        for component_path in BACKGROUND_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    self.assertFalse(
                        component.should_run_background(
                            "write_file", {"run_in_background": True}
                        )
                    )
                    block = types.SimpleNamespace(
                        id="tool_fail",
                        name="bash",
                        input={"command": "exit 7", "run_in_background": True},
                    )
                    if component_path.parent.name in {
                        "s14_mcp_plugin", "s15_integrated_harness"
                    }:
                        bg_id = component.start_background_task(block, {})
                    else:
                        bg_id = component.start_background_task(block)
                    self.assertTrue(
                        wait_until(
                            lambda: component.background_tasks[bg_id]["status"]
                            != "running"
                        )
                    )
                    self.assertEqual(
                        component.background_tasks[bg_id]["status"], "failed"
                    )
                    notification = component.collect_background_results()[0]
                    self.assertIn("<status>failed</status>", notification)
                    self.assertIn("status 7", notification)

    def test_shell_completion_terminates_children_in_the_same_process_group(self):
        for component_path in BACKGROUND_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    marker = Path(tmp) / "late-write.txt"
                    command = (
                        "nohup sh -c "
                        + shlex.quote(f"sleep 0.3; printf late > {marker}")
                        + " >/dev/null 2>&1 &"
                    )

                    _, exit_code = component._run_bash_process(command)
                    time.sleep(0.5)

                    self.assertEqual(exit_code, 0)
                    self.assertFalse(marker.exists())

    def test_sigterm_stops_active_shell_process_groups(self):
        for component_path in BACKGROUND_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    started = root / "started.txt"
                    late = root / "late.txt"
                    command = (
                        f"printf started > {shlex.quote(str(started))}; "
                        f"sleep 0.8; printf late > {shlex.quote(str(late))}"
                    )
                    script = (
                        "import importlib.util, os, sys, time, types\n"
                        "fake_anthropic = types.ModuleType('anthropic')\n"
                        "fake_anthropic.Anthropic = lambda *a, **k: "
                        "types.SimpleNamespace(messages=types.SimpleNamespace(create=None))\n"
                        "fake_dotenv = types.ModuleType('dotenv')\n"
                        "fake_dotenv.load_dotenv = lambda **k: None\n"
                        "fake_yaml = types.ModuleType('yaml')\n"
                        "fake_yaml.safe_load = lambda value: {}\n"
                        "fake_yaml.YAMLError = ValueError\n"
                        "sys.modules.update({'anthropic': fake_anthropic, "
                        "'dotenv': fake_dotenv, 'yaml': fake_yaml})\n"
                        f"os.environ['MODEL_ID'] = 'test-model'\n"
                        f"os.environ['ANTHROPIC_API_KEY'] = 'test-key'\n"
                        f"spec = importlib.util.spec_from_file_location('component', {str(component_path)!r})\n"
                        "component = importlib.util.module_from_spec(spec)\n"
                        "spec.loader.exec_module(component)\n"
                        f"component.run_bash({command!r}, run_in_background=True)\n"
                        "time.sleep(10)\n"
                    )
                    process = subprocess.Popen(
                        [sys.executable, "-c", script],
                        cwd=root,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    try:
                        self.assertTrue(wait_until(started.exists))
                        process.terminate()
                        process.wait(timeout=2)
                        time.sleep(1)
                        self.assertFalse(late.exists())
                    finally:
                        if process.poll() is None:
                            process.kill()
                            process.wait(timeout=2)

    def test_durable_one_shot_is_acknowledged_after_model_acceptance(self):
        for component_path in CRON_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    job = component.CronJob(
                        id="cron_test",
                        cron="* * * * *",
                        prompt="resume the report",
                        recurring=False,
                        durable=True,
                        pending_delivery=True,
                    )
                    component.scheduled_jobs[job.id] = job
                    component.cron_queue.append(job)
                    component.save_durable_jobs()

                    self.assertIn(job.id, component.scheduled_jobs)
                    persisted = component.DURABLE_PATH.read_text()
                    self.assertIn('"pending_delivery": true', persisted)
                    component.client.messages.create = lambda **_: types.SimpleNamespace(
                        content=[], stop_reason="end_turn"
                    )
                    messages = []
                    if component_path.parent.name == "s15_integrated_harness":
                        component.agent_loop(messages, {}, "scheduled delivery")
                    else:
                        component.agent_loop(messages, {})

                    self.assertTrue(any(
                        message.get("content") == "[Scheduled] resume the report"
                        for message in messages
                    ))
                    self.assertNotIn(job.id, component.scheduled_jobs)
                    self.assertNotIn("cron_test", component.DURABLE_PATH.read_text())

    def test_failed_model_call_restores_unacknowledged_cron_delivery(self):
        for component_path in CRON_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    job = component.CronJob(
                        id="cron_retry",
                        cron="* * * * *",
                        prompt="retry me",
                        recurring=False,
                        durable=True,
                        pending_delivery=True,
                    )
                    component.scheduled_jobs[job.id] = job
                    component.cron_queue.append(job)
                    component.save_durable_jobs()
                    component.client.messages.create = (
                        lambda **_: (_ for _ in ()).throw(RuntimeError("offline"))
                    )

                    messages = []
                    if component_path.parent.name == "s15_integrated_harness":
                        component.agent_loop(messages, {}, "scheduled retry")
                    else:
                        component.agent_loop(messages, {})

                    self.assertIn(job.id, component.scheduled_jobs)
                    self.assertEqual(
                        [queued.id for queued in component.cron_queue], [job.id]
                    )
                    self.assertIn(job.id, component.DURABLE_PATH.read_text())

    def test_failed_cron_persistence_retries_before_queueing(self):
        for component_path in CRON_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    job = component.CronJob(
                        id="cron_persist_retry",
                        cron="* * * * *",
                        prompt="persist before delivery",
                        recurring=False,
                        durable=True,
                    )
                    component.scheduled_jobs[job.id] = job
                    original_save = component.save_durable_jobs
                    attempts = 0

                    def flaky_save():
                        nonlocal attempts
                        attempts += 1
                        if attempts == 1:
                            raise OSError("disk unavailable")
                        original_save()

                    component.save_durable_jobs = flaky_save
                    with self.assertRaisesRegex(OSError, "disk unavailable"):
                        with component.cron_lock:
                            component._enqueue_due_job(job)

                    self.assertFalse(job.pending_delivery)
                    self.assertEqual(component.cron_queue, [])

                    with component.cron_lock:
                        component._enqueue_due_job(job)

                    self.assertTrue(job.pending_delivery)
                    self.assertEqual([queued.id for queued in component.cron_queue], [job.id])
                    self.assertIn(
                        '"pending_delivery": true',
                        component.DURABLE_PATH.read_text(),
                    )

    def test_cancelled_cron_is_removed_from_pending_queue(self):
        for component_path in CRON_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    job = component.CronJob(
                        id="cron_cancel",
                        cron="* * * * *",
                        prompt="do not run",
                        recurring=True,
                        durable=True,
                    )
                    component.scheduled_jobs[job.id] = job
                    component.cron_queue.append(job)

                    self.assertIn("Cancelled", component.cancel_job(job.id))
                    self.assertEqual(component.consume_cron_queue(), [])

    def test_mcp_permission_uses_host_policy(self):
        for component_path in MCP_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    component.connect_mcp("deploy")
                    component.assemble_tool_pool()
                    status = types.SimpleNamespace(
                        name="mcp__deploy__status", input={"service": "web"}
                    )
                    trigger = types.SimpleNamespace(
                        name="mcp__deploy__trigger", input={"service": "web"}
                    )

                    self.assertIsNone(component.permission_hook(status))
                    with patch("builtins.input", return_value="no"):
                        self.assertEqual(
                            component.permission_hook(trigger),
                            "Permission denied by user",
                        )

                    spoofed = types.SimpleNamespace(
                        name="mcp__third_party__erase",
                        input={"description": "Erase records. (readOnly)"},
                    )
                    with patch("builtins.input", return_value="no"):
                        self.assertEqual(
                            component.permission_hook(spoofed),
                            "Permission denied by user",
                        )

    def test_integrated_permission_requires_approval_for_every_shell_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            component = load_component(
                root, ROOT / "s15_integrated_harness" / "code.py"
            )
            outside = root.parent / f"outside-{time.time_ns()}.txt"
            block = types.SimpleNamespace(
                name="bash",
                input={"command": f"printf overwritten > {outside}"},
            )
            try:
                with patch("builtins.input", return_value="no"):
                    self.assertEqual(
                        component.permission_hook(block),
                        "Permission denied by user",
                    )
                self.assertFalse(outside.exists())
            finally:
                outside.unlink(missing_ok=True)

    def test_message_bus_rejects_unregistered_or_unsafe_recipients(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            component = load_component(root)
            component.active_teammates["alice"] = "idle"

            with self.assertRaises(ValueError):
                component.BUS.send("alice", "../escape", "bad")
            self.assertFalse((root / "escape.jsonl").exists())

            result = component._teammate_send_message(
                "alice", "ghost", "Are you there?"
            )
            self.assertIn("not active", result)
            self.assertFalse((component.MAILBOX_DIR / "ghost.jsonl").exists())

    def test_reserved_teammate_names_do_not_shadow_runtime_identities(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)

                    for name in ("lead", "agent", "Lead", "Agent"):
                        rejected = component.spawn_teammate_thread(
                            name, "backend", "Inspect auth."
                        )
                        self.assertIn("reserved", rejected.lower())
                        self.assertNotIn(name, component.active_teammates)

                    component.BUS.send("alice", "lead", "still routable")
                    self.assertEqual(
                        component.BUS.read_inbox("lead")[0]["content"],
                        "still routable",
                    )

                    component.active_teammates["Alice"] = "idle"
                    duplicate = component.spawn_teammate_thread(
                        "alice", "backend", "Inspect auth."
                    )
                    self.assertIn("already exists", duplicate)

    def test_public_task_tools_return_errors_for_bad_ids(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    for task_id in ("../escape", "task_missing"):
                        for tool_name in (
                            "run_get_task",
                            "run_claim_task",
                            "run_complete_task",
                        ):
                            with self.subTest(tool=tool_name, task_id=task_id):
                                result = getattr(component, tool_name)(task_id)
                                self.assertIn("Error:", result)

    def test_plan_gate_blocks_mutating_tools_until_approval(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            cases = {
                "write_file": {"path": "config.py", "content": "VALUE = 1"},
                "edit_file": {
                    "path": "config.py", "old_text": "0", "new_text": "1"
                },
            }
            for tool_name, tool_input in cases.items():
                with self.subTest(tool=tool_name):
                    calls = []
                    block = types.SimpleNamespace(
                        name=tool_name, input=tool_input
                    )
                    handlers = {
                        tool_name: lambda **kwargs: calls.append(kwargs) or "done"
                    }

                    component.plan_gates["alice"] = "pending"
                    blocked = component._run_teammate_tool(
                        "alice", block, handlers
                    )
                    self.assertIn("Blocked", blocked)
                    self.assertEqual(calls, [])

                    component.plan_gates["alice"] = "approved"
                    allowed = component._run_teammate_tool(
                        "alice", block, handlers
                    )
                    self.assertEqual(allowed, "done")
                    self.assertEqual(len(calls), 1)

    def test_teammate_tool_errors_become_tool_results(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.plan_gates["alice"] = "not_required"
            block = types.SimpleNamespace(
                name="write_file", input={"path": "config.py"}
            )

            result = component._run_teammate_tool(
                "alice", block,
                {"write_file": lambda path, content: "wrote"},
            )

            self.assertIn("TypeError", result)

    def test_teammate_keeps_complete_tool_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.IDLE_SCAN_INTERVAL = 5.0
            calls = 0

            def respond(**kwargs):
                nonlocal calls
                calls += 1
                self.assertEqual(
                    kwargs["messages"][0]["content"], "Inspect the project."
                )
                if calls <= 11:
                    return types.SimpleNamespace(
                        stop_reason="tool_use",
                        content=[types.SimpleNamespace(
                            type="tool_use", name="list_tasks",
                            id=f"list-{calls}", input={},
                        )],
                    )
                return types.SimpleNamespace(
                    stop_reason="end_turn",
                    content=[types.SimpleNamespace(
                        type="text", text="Inspection complete."
                    )],
                )

            component.client.messages.create = respond
            component.spawn_teammate_thread(
                "alice", "reviewer", "Inspect the project."
            )
            self.assertTrue(wait_until(
                lambda: component.BUS.peek("lead"), timeout=3.0
            ))
            self.assertEqual(calls, 12)
            component.run_request_shutdown("alice")
            self.assertTrue(wait_until(
                lambda: "alice" not in component.active_teammates
            ))

    def test_s15_teammate_dispatch_runs_permission_and_post_hooks(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )
            block = types.SimpleNamespace(
                name="write_file",
                input={"path": "config.py", "content": "VALUE = 1"},
            )
            calls = []
            handlers = {
                "write_file": lambda **kwargs: calls.append(
                    ("handler", kwargs)
                ) or "wrote"
            }
            component.plan_gates["alice"] = "approved"
            component.HOOKS["PreToolUse"] = [
                lambda seen: calls.append(("pre", seen.name)) or "denied"
            ]
            component.HOOKS["PostToolUse"] = [
                lambda seen, output: calls.append(
                    ("post", seen.name, output)
                )
            ]

            denied = component._run_teammate_tool("alice", block, handlers)
            self.assertEqual(denied, "denied")
            self.assertEqual(calls, [("pre", "write_file")])

            calls.clear()
            component.HOOKS["PreToolUse"] = [
                lambda seen: calls.append(("pre", seen.name))
            ]
            allowed = component._run_teammate_tool("alice", block, handlers)

            self.assertEqual(allowed, "wrote")
            self.assertEqual(
                calls,
                [
                    ("pre", "write_file"),
                    ("handler", block.input),
                    ("post", "write_file", "wrote"),
                ],
            )

    def test_s15_teammate_reads_shutdown_between_tool_rounds(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )
            entered = threading.Event()
            release = threading.Event()
            calls = []

            def create(**_kwargs):
                calls.append("llm")
                entered.set()
                release.wait(timeout=2)
                block = types.SimpleNamespace(
                    type="tool_use", id="tool_1", name="list_tasks", input={}
                )
                return types.SimpleNamespace(
                    stop_reason="tool_use", content=[block]
                )

            component.client.messages.create = create
            component.spawn_teammate_thread("alice", "reviewer", "Inspect tasks")
            self.assertTrue(entered.wait(timeout=2))
            component.run_request_shutdown("alice")
            release.set()

            self.assertTrue(
                wait_until(lambda: "alice" not in component.active_teammates)
            )
            self.assertEqual(calls, ["llm"])

    def test_normalized_mcp_tool_name_collisions_are_rejected(self):
        for component_path in MCP_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    first = component.MCPClient("docs.one")
                    first.register(
                        [{"name": "get.version", "inputSchema": {}}],
                        {"get.version": lambda: "one"},
                    )
                    second = component.MCPClient("docs_one")
                    second.register(
                        [{"name": "get_version", "inputSchema": {}}],
                        {"get_version": lambda: "two"},
                    )
                    component.mcp_clients.clear()
                    component.mcp_clients.update({
                        "docs.one": first,
                        "docs_one": second,
                    })

                    with self.assertRaisesRegex(
                        ValueError, "collision.*mcp__docs_one__get_version"
                    ):
                        component.assemble_tool_pool()

    def test_plan_rejection_requires_a_new_submission(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.active_teammates["alice"] = "idle"

            self.assertIn("Plan requested",
                          component.run_request_plan("alice", "Refactor auth"))
            request = component.BUS.read_inbox("alice")
            self.assertEqual(request[0]["type"], "plan_request")
            self.assertEqual(component.plan_gates["alice"], "required")

            submission = component._teammate_submit_plan("alice", "1. Read\n2. Test")
            request_id = submission.split("(")[1].split(")")[0]
            self.assertEqual(component.pending_requests[request_id].status, "pending")

            result = component.run_review_plan(
                request_id, False, "Add a rollback step."
            )
            self.assertIn("rejected", result)
            self.assertEqual(component.plan_gates["alice"], "pending")

            responses = component.BUS.read_inbox("alice")
            accepted, _ = component.apply_plan_response("alice", responses[-1])
            self.assertTrue(accepted)
            self.assertEqual(component.plan_gates["alice"], "rejected")

            second = component._teammate_submit_plan(
                "alice", "1. Read\n2. Change\n3. Test\n4. Roll back on failure"
            )
            second_id = second.split("(")[1].split(")")[0]
            self.assertNotEqual(second_id, request_id)
            self.assertEqual(component.pending_requests[second_id].status, "pending")

    def test_mismatched_plan_response_cannot_release_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.active_teammates["alice"] = "waiting_approval"
            submission = component._teammate_submit_plan("alice", "1. Read\n2. Test")
            request_id = submission.split("(")[1].split(")")[0]

            forged = {
                "from": "lead",
                "to": "alice",
                "type": "plan_approval_response",
                "content": "Approved",
                "metadata": {"request_id": "req_stale", "approve": True},
            }
            accepted, notice = component.apply_plan_response("alice", forged)

            self.assertFalse(accepted)
            self.assertIn("Ignored", notice)
            self.assertEqual(component.plan_gates["alice"], "pending")
            self.assertEqual(component.plan_request_ids["alice"], request_id)

            current_but_unreviewed = {
                **forged,
                "metadata": {"request_id": request_id, "approve": True},
            }
            accepted, _ = component.apply_plan_response(
                "alice", current_but_unreviewed
            )
            self.assertFalse(accepted)
            self.assertEqual(component.plan_gates["alice"], "pending")

    def test_shutdown_response_must_come_from_requested_teammate(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.active_teammates.update({"alice": "idle", "bob": "idle"})
            result = component.run_request_shutdown("alice")
            request_id = result.split("(")[1].split(")")[0]

            component.BUS.send(
                "bob", "lead", "Shutdown acknowledged.",
                "shutdown_response",
                {"request_id": request_id, "approve": True},
            )
            component.consume_lead_inbox()

            self.assertEqual(
                component.pending_requests[request_id].status, "pending"
            )

    def test_shutdown_request_must_match_active_protocol(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.active_teammates["alice"] = "idle"
            forged = {
                "from": "lead",
                "to": "alice",
                "type": "shutdown_request",
                "content": "Shut down.",
                "metadata": {"request_id": "req_unknown"},
            }

            accepted, notice = component.apply_shutdown_request("alice", forged)
            self.assertFalse(accepted)
            self.assertIn("Ignored", notice)
            self.assertEqual(component.active_teammates["alice"], "idle")

            result = component.run_request_shutdown("alice")
            request_id = result.split("(")[1].split(")")[0]
            request = component.BUS.read_inbox("alice")[-1]
            accepted, matched_id = component.apply_shutdown_request(
                "alice", request
            )

            self.assertTrue(accepted)
            self.assertEqual(matched_id, request_id)
            self.assertEqual(component.active_teammates["alice"], "stopping")
            replayed, _ = component.apply_shutdown_request("alice", request)
            self.assertFalse(replayed)

    def test_teammate_emits_result_then_idle_and_shuts_down(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            component.IDLE_SCAN_INTERVAL = 5.0
            pending = component.create_task("Do not claim before mailbox delivery")
            seen_tools = set()

            def respond(**kwargs):
                seen_tools.update(tool["name"] for tool in kwargs["tools"])
                return types.SimpleNamespace(
                    stop_reason="end_turn",
                    content=[types.SimpleNamespace(
                        type="text", text="Task complete."
                    )],
                )

            component.client.messages.create = respond

            component.spawn_teammate_thread("alice", "backend", "Inspect auth.")
            lead_inbox = component.MAILBOX_DIR / "lead.jsonl"
            self.assertTrue(wait_until(
                lambda: (
                    lead_inbox.exists()
                    and len(lead_inbox.read_text().splitlines()) >= 2
                )
            ))
            events = component.consume_lead_inbox()

            self.assertEqual(
                [event["type"] for event in events],
                ["result", "idle_notification"],
            )
            self.assertEqual(component.active_teammates["alice"], "idle")
            self.assertTrue(
                {"list_tasks", "claim_task", "complete_task"}
                .issubset(seen_tools)
            )
            self.assertTrue(
                {"create_worktree", "remove_worktree", "keep_worktree"}
                .isdisjoint(seen_tools)
            )

            component.run_request_shutdown("alice")
            self.assertTrue(
                wait_until(lambda: "alice" not in component.active_teammates)
            )
            shutdown_events = component.consume_lead_inbox()
            self.assertEqual(shutdown_events[-1]["type"], "shutdown_response")
            request_id = shutdown_events[-1]["metadata"]["request_id"]
            self.assertEqual(
                component.pending_requests[request_id].status, "approved"
            )
            self.assertEqual(component.load_task(pending.id).status, "pending")

    def test_downstream_teammates_continue_past_ten_tool_rounds(self):
        for component_path in DOWNSTREAM_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    component.IDLE_SCAN_INTERVAL = 5.0
                    calls = 0

                    def respond(**kwargs):
                        nonlocal calls
                        calls += 1
                        if calls <= 11:
                            return types.SimpleNamespace(
                                stop_reason="tool_use",
                                content=[types.SimpleNamespace(
                                    type="tool_use",
                                    name="list_tasks",
                                    id=f"list-{calls}",
                                    input={},
                                )],
                            )
                        return types.SimpleNamespace(
                            stop_reason="end_turn",
                            content=[types.SimpleNamespace(
                                type="text", text="Long task complete."
                            )],
                        )

                    component.client.messages.create = respond
                    component.spawn_teammate_thread(
                        "alice", "backend", "Use more than ten tool rounds."
                    )
                    lead_inbox = component.MAILBOX_DIR / "lead.jsonl"
                    self.assertTrue(wait_until(
                        lambda: (
                            lead_inbox.exists()
                            and len(lead_inbox.read_text().splitlines()) >= 2
                        ),
                        timeout=3.0,
                    ))
                    events = component.consume_lead_inbox()

                    self.assertEqual(calls, 12)
                    self.assertEqual(
                        [event["type"] for event in events],
                        ["result", "idle_notification"],
                    )
                    self.assertEqual(
                        component.active_teammates.get("alice"), "idle"
                    )
                    component.run_request_shutdown("alice")
                    self.assertTrue(wait_until(
                        lambda: "alice" not in component.active_teammates
                    ))

    def test_teammate_exception_releases_runtime_and_task_ownership(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    task = component.create_task("Implement auth")
                    calls = 0

                    def respond(**kwargs):
                        nonlocal calls
                        calls += 1
                        tool_name = "claim_task" if calls == 1 else "list_tasks"
                        tool_input = {"task_id": task.id} if calls == 1 else {}
                        return types.SimpleNamespace(
                            stop_reason="tool_use",
                            content=[types.SimpleNamespace(
                                type="tool_use", name=tool_name,
                                id=f"tool-{calls}", input=tool_input,
                            )],
                        )

                    original_dispatch = component._run_teammate_tool

                    def crash_after_claim(name, block, handlers):
                        if block.name == "list_tasks":
                            raise RuntimeError("simulated dispatch failure")
                        return original_dispatch(name, block, handlers)

                    component.client.messages.create = respond
                    component._run_teammate_tool = crash_after_claim
                    component.spawn_teammate_thread(
                        "alice", "backend", "Claim and begin work."
                    )

                    self.assertTrue(wait_until(
                        lambda: "alice" not in component.active_teammates
                    ))
                    self.assertNotIn("alice", component.teammate_assignments)
                    recovered = component.load_task(task.id)
                    self.assertEqual(recovered.status, "pending")
                    self.assertIsNone(recovered.owner)
                    events = component.consume_lead_inbox()
                    self.assertEqual([event["type"] for event in events], ["error"])
                    self.assertIn("simulated dispatch failure", events[0]["content"])

    def test_s15_completed_background_task_wakes_the_agent_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )
            seen_messages = []

            def respond(messages, context, tools, state, max_tokens):
                seen_messages.append(list(messages))
                return types.SimpleNamespace(
                    stop_reason="end_turn",
                    content=[types.SimpleNamespace(
                        type="text", text="Background result handled."
                    )],
                )

            component.call_llm = respond
            component.background_tasks["bg_0001"] = {
                "tool_use_id": "tool-1",
                "command": "pytest",
                "status": "completed",
            }
            component.background_results["bg_0001"] = "all tests passed"
            history = []
            context = {}
            session_state = {"active_user_request": "Run tests"}
            threading.Thread(
                target=component.async_event_loop,
                args=(history, context, session_state),
                daemon=True,
            ).start()

            self.assertTrue(wait_until(lambda: bool(seen_messages), timeout=3.0))
            delivered = str(seen_messages[0])
            self.assertIn("<task_notification>", delivered)
            self.assertIn("all tests passed", delivered)
            self.assertFalse(component.has_pending_background())
            calls_after_delivery = len(seen_messages)
            time.sleep(1.2)
            self.assertEqual(len(seen_messages), calls_after_delivery)

    def test_s15_background_results_have_one_atomic_consumer(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )

            class CoordinatedLock:
                def __init__(self):
                    self.lock = threading.Lock()
                    self.barrier = threading.Barrier(2)
                    self.local = threading.local()

                def __enter__(self):
                    self.lock.acquire()
                    return self

                def __exit__(self, exc_type, exc_value, traceback):
                    self.lock.release()
                    if not getattr(self.local, "coordinated", False):
                        self.local.coordinated = True
                        self.barrier.wait(timeout=2.0)

            component.background_tasks["bg_0001"] = {
                "tool_use_id": "tool-1",
                "command": "pytest",
                "status": "completed",
            }
            component.background_results["bg_0001"] = "all tests passed"
            component.background_lock = CoordinatedLock()

            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(
                    lambda _: component.collect_background_results(), range(2)
                ))

            notifications = [note for batch in results for note in batch]
            self.assertEqual(len(notifications), 1)
            self.assertIn("all tests passed", notifications[0])
            self.assertFalse(component.background_tasks)
            self.assertFalse(component.background_results)

    def test_s15_background_ids_are_allocated_atomically(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )

            class TrackingLock:
                def __init__(self):
                    self.lock = threading.Lock()
                    self.owner = None

                def __enter__(self):
                    self.lock.acquire()
                    self.owner = threading.get_ident()
                    return self

                def __exit__(self, exc_type, exc_value, traceback):
                    self.owner = None
                    self.lock.release()

                def held_by_current_thread(self):
                    return self.owner == threading.get_ident()

            class RaceAwareCounter:
                def __init__(self, lock):
                    self.lock = lock
                    self.barrier = threading.Barrier(2)

                def __add__(self, value):
                    if not self.lock.held_by_current_thread():
                        self.barrier.wait(timeout=2.0)
                    return 1

            blocks = [
                types.SimpleNamespace(
                    id=f"tool-{index}",
                    name="bash",
                    input={"command": f"printf {index}",
                           "run_in_background": True},
                )
                for index in (1, 2)
            ]
            lock = TrackingLock()
            component.background_lock = lock
            component._bg_counter = RaceAwareCounter(lock)
            component._run_bash_process = lambda *args, **kwargs: ("ok", 0)
            with ThreadPoolExecutor(max_workers=2) as executor:
                task_ids = list(executor.map(
                    lambda block: component.start_background_task(block, {}),
                    blocks,
                ))

            self.assertCountEqual(task_ids, ["bg_0001", "bg_0002"])
            self.assertEqual(set(component.background_tasks),
                             {"bg_0001", "bg_0002"})

    def test_s15_background_hook_failure_reaches_terminal_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )
            block = types.SimpleNamespace(
                id="tool-hook",
                name="bash",
                input={"command": "printf ok", "run_in_background": True},
            )
            component._run_bash_process = lambda *args, **kwargs: ("ok", 0)

            def fail_post_hook(event, *args):
                if event == "PostToolUse":
                    raise RuntimeError("hook failed")

            component.trigger_hooks = fail_post_hook
            bg_id = component.start_background_task(block, {})

            self.assertTrue(wait_until(
                lambda: component.background_tasks[bg_id]["status"] != "running"
            ))
            self.assertEqual(component.background_tasks[bg_id]["status"], "failed")
            self.assertIn("PostToolUse hook failed",
                          component.background_results[bg_id])
            notification = component.collect_background_results()[0]
            self.assertIn("<status>failed</status>", notification)
            self.assertIn("PostToolUse hook failed", notification)

    def test_s15_background_thread_start_failure_rolls_back_task(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )
            block = types.SimpleNamespace(
                id="tool-start",
                name="bash",
                input={"command": "printf ok", "run_in_background": True},
            )

            class FailingThread:
                def __init__(self, *args, **kwargs):
                    pass

                def start(self):
                    raise RuntimeError("cannot start thread")

            with patch.object(component.threading, "Thread", FailingThread):
                with self.assertRaisesRegex(RuntimeError, "cannot start thread"):
                    component.start_background_task(block, {})

            self.assertFalse(component.background_tasks)
            self.assertFalse(component.background_results)

    def test_s15_background_start_failure_becomes_tool_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(
                Path(tmp), ROOT / "s15_integrated_harness" / "code.py"
            )
            block = types.SimpleNamespace(
                type="tool_use",
                id="tool-start",
                name="bash",
                input={"command": "printf ok", "run_in_background": True},
            )
            responses = iter([
                types.SimpleNamespace(
                    stop_reason="tool_use",
                    content=[block],
                ),
                types.SimpleNamespace(
                    stop_reason="end_turn",
                    content=[types.SimpleNamespace(type="text", text="done")],
                ),
            ])
            component.call_llm = lambda *args, **kwargs: next(responses)
            component.trigger_hooks = lambda *args, **kwargs: None
            component.remember_after_turn = lambda messages: None

            def fail_start(*args, **kwargs):
                raise RuntimeError("cannot start thread")

            component.start_background_task = fail_start
            messages = []
            component.agent_loop(messages, {}, "run in background")

            tool_results = [
                item
                for message in messages
                if message.get("role") == "user"
                and isinstance(message.get("content"), list)
                for item in message["content"]
                if item.get("type") == "tool_result"
            ]
            self.assertEqual(len(tool_results), 1)
            self.assertIn("Failed to start background task",
                          tool_results[0]["content"])
            self.assertIn("cannot start thread", tool_results[0]["content"])

    def test_teammate_survives_stale_worktree_assignment(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            component.IDLE_SCAN_INTERVAL = 5.0
            task = component.create_task("Implement auth")
            component.create_worktree("auth", task.id)
            worktree = component.WORKTREES_DIR / "auth"
            calls = 0
            bash_result = []

            def respond(**kwargs):
                nonlocal calls
                calls += 1
                if calls == 1:
                    return types.SimpleNamespace(
                        stop_reason="tool_use",
                        content=[types.SimpleNamespace(
                            type="tool_use", name="claim_task", id="claim-1",
                            input={"task_id": task.id},
                        )],
                    )
                if calls == 2:
                    subprocess.run(
                        ["git", "worktree", "remove", "--force",
                         str(worktree)], cwd=root, check=True,
                    )
                    return types.SimpleNamespace(
                        stop_reason="tool_use",
                        content=[types.SimpleNamespace(
                            type="tool_use", name="bash", id="bash-1",
                            input={"command": "pwd"},
                        )],
                    )
                bash_result.append(
                    kwargs["messages"][-1]["content"][0]["content"]
                )
                return types.SimpleNamespace(
                    stop_reason="end_turn",
                    content=[types.SimpleNamespace(
                        type="text", text="Handled stale assignment."
                    )],
                )

            component.client.messages.create = respond
            component.spawn_teammate_thread("alice", "backend", "Claim the task.")

            self.assertTrue(wait_until(lambda: bool(bash_result)))
            self.assertIn("Invalid task assignment", bash_result[0])
            self.assertIn("alice", component.active_teammates)
            component.run_request_shutdown("alice")
            self.assertTrue(
                wait_until(lambda: "alice" not in component.active_teammates)
            )

    def test_idle_claim_is_atomic_across_teammates(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            task = component.create_task("Refactor auth")

            barrier = threading.Barrier(3)
            claimed = {}

            def claim(name):
                barrier.wait()
                claimed[name] = component.claim_next_task(name)

            threads = [
                threading.Thread(target=claim, args=(name,))
                for name in ("alice", "bob")
            ]
            for thread in threads:
                thread.start()
            barrier.wait()
            for thread in threads:
                thread.join(timeout=2)

            self.assertTrue(all(not thread.is_alive() for thread in threads))
            self.assertEqual(
                len([result for result in claimed.values() if result is not None]),
                1,
            )
            winner = next(result.owner for result in claimed.values()
                          if result is not None)
            self.assertEqual(component.load_task(task.id).owner, winner)

    def test_assignment_enforces_one_task_and_owner_only_completion(self):
        with tempfile.TemporaryDirectory() as tmp:
            component = load_component(Path(tmp))
            first = component.create_task("Refactor auth")
            second = component.create_task("Refactor login")

            self.assertIn("Claimed", component.claim_task(first.id, owner="alice"))
            denied = component.claim_task(second.id, owner="alice")
            self.assertIn("must finish", denied)
            self.assertEqual(component.load_task(second.id).status, "pending")

            denied = component.complete_task(first.id, owner="bob")
            self.assertIn("not bob", denied)
            self.assertEqual(component.load_task(first.id).status, "in_progress")

            self.assertIn(
                "Completed", component.complete_task(first.id, owner="alice")
            )
            self.assertIn("alice", component.teammate_assignments)
            denied = component.claim_task(second.id, owner="alice")
            self.assertIn("must finish", denied)
            self.assertTrue(component.release_completed_assignment("alice"))
            self.assertIn("Claimed", component.claim_task(second.id, owner="alice"))

    def test_completed_assignment_keeps_lead_in_worktree_until_turn_boundary(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    init_git_repo(root)
                    component = load_component(root, component_path)
                    first = component.create_task("Implement auth")
                    second = component.create_task("Update docs")
                    component.create_worktree("auth", first.id)

                    self.assertIn(
                        "Claimed", component.claim_task(first.id, owner="agent")
                    )
                    self.assertIn(
                        "Completed", component.complete_task(first.id, owner="agent")
                    )
                    self.assertIn(
                        "Wrote",
                        component.run_agent_write("after-complete.txt", "done"),
                    )
                    self.assertTrue(
                        (component.WORKTREES_DIR / "auth" / "after-complete.txt").exists()
                    )
                    self.assertFalse((root / "after-complete.txt").exists())
                    self.assertIn(
                        "must finish",
                        component.claim_task(second.id, owner="agent"),
                    )

                    self.assertTrue(component.release_completed_assignment("agent"))
                    self.assertIn(
                        "Claimed", component.claim_task(second.id, owner="agent")
                    )

    def test_in_progress_assignment_rehydrates_after_runtime_restart(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    init_git_repo(root)
                    component = load_component(root, component_path)
                    task = component.create_task("Implement auth")
                    component.create_worktree("auth", task.id)
                    component.claim_task(task.id, owner="alice")

                    component.teammate_assignments.clear()
                    recovered = component.assignment_cwd("alice")

                    self.assertEqual(
                        recovered.resolve(),
                        (component.WORKTREES_DIR / "auth").resolve(),
                    )
                    self.assertEqual(
                        component.teammate_assignments["alice"]["task_id"], task.id
                    )

    def test_completion_rehydrates_cwd_lease_before_status_change(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    init_git_repo(root)
                    component = load_component(root, component_path)
                    task = component.create_task("Implement auth")
                    component.create_worktree("auth", task.id)
                    component.claim_task(task.id, owner="agent")
                    component.teammate_assignments.clear()

                    self.assertIn(
                        "Completed", component.complete_task(task.id, owner="agent")
                    )
                    self.assertIn(
                        "Wrote", component.run_agent_write("after.txt", "done")
                    )
                    self.assertTrue(
                        (component.WORKTREES_DIR / "auth" / "after.txt").exists()
                    )
                    self.assertFalse((root / "after.txt").exists())

    def test_completion_replaces_a_stale_cross_runtime_cwd_lease(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    init_git_repo(root)
                    first = load_component(root, component_path)
                    old_task = first.create_task("Old assignment")
                    first.create_worktree("old", old_task.id)
                    first.claim_task(old_task.id, owner="agent")
                    first.complete_task(old_task.id, owner="agent")

                    second = load_component(root, component_path)
                    new_task = second.create_task("New assignment")
                    second.create_worktree("new", new_task.id)
                    second.claim_task(new_task.id, owner="agent")

                    self.assertIn(
                        "Completed",
                        first.complete_task(new_task.id, owner="agent"),
                    )
                    self.assertIn(
                        "Wrote", first.run_agent_write("after.txt", "done")
                    )
                    self.assertTrue(
                        (first.WORKTREES_DIR / "new" / "after.txt").exists()
                    )
                    self.assertFalse(
                        (first.WORKTREES_DIR / "old" / "after.txt").exists()
                    )

    def test_task_claim_is_atomic_across_processes(self):
        context = multiprocessing.get_context("spawn")
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    task = component.create_task("Only once")
                    barrier = context.Barrier(3)
                    results = context.Queue()

                    workers = [
                        context.Process(
                            target=claim_in_child,
                            args=(
                                str(component_path), tmp, task.id, owner,
                                barrier, results,
                            ),
                        )
                        for owner in ("alice", "bob")
                    ]
                    for worker in workers:
                        worker.start()
                    barrier.wait()
                    for worker in workers:
                        worker.join(5)
                        self.assertEqual(worker.exitcode, 0)
                    outcomes = [results.get(timeout=1) for _ in workers]

                    self.assertEqual(
                        sum(outcome.startswith("Claimed ") for outcome in outcomes),
                        1,
                    )
                    persisted = component.load_task(task.id)
                    self.assertEqual(persisted.status, "in_progress")
                    self.assertIn(persisted.owner, {"alice", "bob"})

    def test_plan_approval_cannot_cross_assignment_boundary(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    component.active_teammates["alice"] = "working"
                    component.plan_gates["alice"] = "required"
                    component.assignment_versions["alice"] = 1
                    component._teammate_submit_plan("alice", "Inspect, edit, test")
                    request_id = next(iter(component.pending_requests))

                    component.advance_assignment_version("alice")
                    result = component.run_review_plan(request_id, True)

                    self.assertIn("earlier assignment", result)
                    self.assertNotEqual(component.plan_gates["alice"], "approved")

    def test_required_plan_is_active_before_teammate_thread_starts(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    tool_defs = getattr(component, "TOOLS", None)
                    if tool_defs is None:
                        tool_defs = component.BUILTIN_TOOLS
                    spawn_schema = next(
                        tool["input_schema"] for tool in tool_defs
                        if tool["name"] == "spawn_teammate"
                    )
                    self.assertIn("require_plan", spawn_schema["properties"])
                    with patch.object(
                        component.threading.Thread, "start", lambda _thread: None
                    ):
                        component.spawn_teammate_thread(
                            "alice", "backend", "Claim and edit.",
                            require_plan=True,
                        )
                    task = component.create_task("Edit auth")
                    self.assertIn("Claimed", component.claim_task(task.id, "alice"))
                    self.assertEqual(component.plan_gates["alice"], "required")
                    calls = []
                    block = types.SimpleNamespace(
                        name="write_file",
                        input={"path": "auth.py", "content": "changed"},
                    )
                    denied = component._run_teammate_tool(
                        "alice", block,
                        {"write_file": lambda **kw: calls.append(kw)},
                    )
                    self.assertIn("Blocked", denied)
                    self.assertEqual(calls, [])

    def test_worktree_registry_parsing_does_not_use_display_truncation(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    component = load_component(Path(tmp), component_path)
                    entries = []
                    for index in range(80):
                        path = Path(tmp) / ".worktrees" / (f"work-{index}-" + "x" * 80)
                        entries.append(
                            f"worktree {path}\nHEAD {'0' * 40}\n"
                            f"branch refs/heads/wt/work-{index}\n"
                        )
                    porcelain = "\n".join(entries)
                    self.assertGreater(len(porcelain), 5000)
                    component._run_git = lambda args, cwd=None: (True, porcelain)

                    registered, error = component._registered_worktrees()

                    self.assertIsNone(error)
                    self.assertEqual(len(registered), 80)

    def test_task_worktree_sets_assignment_cwd_and_contains_file_tools(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")

            created = component.create_worktree("auth", task.id)
            self.assertIn("created", created)
            worktree = component.WORKTREES_DIR / "auth"
            self.assertEqual(component.load_task(task.id).worktree, "auth")

            self.assertIn("Claimed", component.claim_task(task.id, owner="alice"))
            assignment = component.teammate_assignments["alice"]
            self.assertEqual(assignment["task_id"], task.id)
            self.assertEqual(assignment["cwd"], worktree)
            self.assertIn(
                "Wrote", component.run_write(
                    "nested/result.txt", "done", cwd=component.assignment_cwd("alice")
                )
            )
            self.assertEqual((worktree / "nested" / "result.txt").read_text(),
                             "done")
            escaped = component.run_write(
                "../outside.txt", "bad", cwd=component.assignment_cwd("alice")
            )
            self.assertIn("escapes workspace", escaped)
            self.assertFalse((component.WORKTREES_DIR / "outside.txt").exists())
            missing_cwd = component.run_bash("pwd", cwd=worktree / "missing")
            self.assertIn("FileNotFoundError", missing_cwd)

    def test_invalid_or_unregistered_worktree_never_becomes_claimable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")

            invalid = component.create_worktree("../escape", task.id)
            self.assertIn("Error", invalid)
            self.assertIsNone(component.load_task(task.id).worktree)
            self.assertFalse((root / "escape").exists())

            missing = component.create_worktree("auth", "../missing")
            self.assertIn("Error", missing)
            self.assertFalse((component.WORKTREES_DIR / "auth").exists())

            bound = component.load_task(task.id)
            bound.worktree = "ghost"
            component.save_task(bound)
            denied = component.claim_task(task.id, owner="alice")
            self.assertIn("not registered", denied)
            self.assertEqual(component.load_task(task.id).status, "pending")
            self.assertEqual(component.scan_unclaimed_tasks(), [])

    def test_create_validates_branch_and_binds_only_after_git_add(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")
            subprocess.run(
                ["git", "branch", "wt/auth"], cwd=root, check=True
            )

            collision = component.create_worktree("auth", task.id)
            self.assertIn("already exists", collision)
            self.assertIsNone(component.load_task(task.id).worktree)
            self.assertFalse((component.WORKTREES_DIR / "auth").exists())

            original_run_git = component.run_git

            def fail_add(args, cwd=None):
                if args[:2] == ["worktree", "add"]:
                    return False, "simulated add failure"
                return original_run_git(args, cwd=cwd)

            component.run_git = fail_add
            failed = component.create_worktree("login", task.id)
            self.assertIn("simulated add failure", failed)
            self.assertIsNone(component.load_task(task.id).worktree)
            self.assertFalse((component.WORKTREES_DIR / "login").exists())

    def test_failed_git_add_reports_and_preserves_partial_artifacts(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    init_git_repo(root)
                    component = load_component(root, component_path)
                    task = component.create_task("Implement auth")
                    original_run_git = component.run_git

                    def fail_after_add(args, cwd=None):
                        if args[:2] == ["worktree", "add"]:
                            ok, output = original_run_git(args, cwd=cwd)
                            self.assertTrue(ok, output)
                            return False, "simulated late add failure"
                        return original_run_git(args, cwd=cwd)

                    component.run_git = fail_after_add
                    result = component.create_worktree("auth", task.id)

                    self.assertIn("Partial operation", result)
                    self.assertIn("simulated late add failure", result)
                    self.assertIn("remains unbound", result)
                    self.assertIn("git worktree list", result)
                    self.assertTrue((component.WORKTREES_DIR / "auth").is_dir())
                    self.assertIsNone(component.load_task(task.id).worktree)
                    branch = subprocess.run(
                        ["git", "show-ref", "--verify", "--quiet",
                         "refs/heads/wt/auth"],
                        cwd=root,
                    )
                    self.assertEqual(branch.returncode, 0)

    def test_binding_failure_retains_created_git_data_for_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")
            original_save_task = component.save_task

            def fail_binding(candidate):
                if candidate.worktree == "auth":
                    raise OSError("simulated task persistence failure")
                original_save_task(candidate)

            component.save_task = fail_binding
            result = component.create_worktree("auth", task.id)

            self.assertIn("Partial success", result)
            self.assertIn("manual recovery", result)
            self.assertTrue((component.WORKTREES_DIR / "auth").is_dir())
            self.assertIsNone(component.load_task(task.id).worktree)
            branch = subprocess.run(
                ["git", "show-ref", "--verify", "--quiet",
                 "refs/heads/wt/auth"], cwd=root,
            )
            self.assertEqual(branch.returncode, 0)

    def test_remove_worktree_refuses_dirty_checkout_by_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")
            component.create_worktree("auth", task.id)
            component.claim_task(task.id, owner="alice")
            component.complete_task(task.id, owner="alice")
            component.release_completed_assignment("alice")
            worktree = component.WORKTREES_DIR / "auth"
            (worktree / "dirty.txt").write_text("unsaved\n")

            denied = component.remove_worktree("auth")

            self.assertIn("uncommitted", denied)
            self.assertTrue(worktree.exists())
            self.assertEqual(component.load_task(task.id).worktree, "auth")

    def test_remove_worktree_treats_ignored_files_as_uncommitted_data(self):
        for component_path in RUNTIME_COMPONENTS:
            with self.subTest(component=component_path.parent.name):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    init_git_repo(root)
                    (root / ".gitignore").write_text("ignored.log\n")
                    subprocess.run(
                        ["git", "add", ".gitignore"], cwd=root, check=True
                    )
                    subprocess.run(
                        ["git", "commit", "-q", "-m", "ignore runtime log"],
                        cwd=root,
                        check=True,
                    )
                    component = load_component(root, component_path)
                    task = component.create_task("Implement auth")
                    component.create_worktree("auth", task.id)
                    component.claim_task(task.id, owner="alice")
                    component.complete_task(task.id, owner="alice")
                    component.release_completed_assignment("alice")
                    worktree = component.WORKTREES_DIR / "auth"
                    (worktree / "ignored.log").write_text("valuable output\n")

                    denied = component.remove_worktree("auth")

                    self.assertIn("uncommitted", denied)
                    self.assertTrue(worktree.exists())
                    self.assertEqual(component.load_task(task.id).worktree, "auth")
                    removed = component.remove_worktree(
                        "auth", discard_changes=True
                    )
                    self.assertIn("branch 'wt/auth' retained", removed)
                    self.assertFalse(worktree.exists())

    def test_discard_removes_checkout_but_retains_branch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")
            component.create_worktree("auth", task.id)
            component.claim_task(task.id, owner="alice")
            component.complete_task(task.id, owner="alice")
            component.release_completed_assignment("alice")
            worktree = component.WORKTREES_DIR / "auth"
            (worktree / "dirty.txt").write_text("discard me\n")

            removed = component.remove_worktree("auth", discard_changes=True)

            self.assertIn("branch 'wt/auth' retained", removed)
            self.assertFalse(worktree.exists())
            self.assertIsNone(component.load_task(task.id).worktree)
            branch = subprocess.run(
                ["git", "show-ref", "--verify", "--quiet",
                 "refs/heads/wt/auth"], cwd=root,
            )
            self.assertEqual(branch.returncode, 0)

    def test_clean_local_commit_survives_non_force_checkout_removal(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")
            component.create_worktree("auth", task.id)
            component.claim_task(task.id, owner="alice")
            component.complete_task(task.id, owner="alice")
            component.release_completed_assignment("alice")
            worktree = component.WORKTREES_DIR / "auth"
            (worktree / "feature.txt").write_text("committed work\n")
            subprocess.run(
                ["git", "add", "feature.txt"], cwd=worktree, check=True
            )
            subprocess.run(
                ["git", "commit", "-q", "-m", "feature"],
                cwd=worktree, check=True,
            )
            commit = subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=worktree, text=True
            ).strip()
            upstream = subprocess.check_output(
                ["git", "for-each-ref", "--format=%(upstream)",
                 "refs/heads/wt/auth"], cwd=root, text=True,
            ).strip()
            self.assertEqual(upstream, "")

            removed = component.remove_worktree("auth")

            self.assertIn("branch 'wt/auth' retained", removed)
            self.assertFalse(worktree.exists())
            retained = subprocess.check_output(
                ["git", "rev-parse", "wt/auth"], cwd=root, text=True
            ).strip()
            self.assertEqual(retained, commit)

    def test_active_task_blocks_normal_and_discard_removal(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init_git_repo(root)
            component = load_component(root)
            task = component.create_task("Implement auth")
            component.create_worktree("auth", task.id)
            worktree = component.WORKTREES_DIR / "auth"

            pending_normal = component.remove_worktree("auth")
            pending_discard = component.remove_worktree(
                "auth", discard_changes=True
            )
            self.assertIn("active task", pending_normal)
            self.assertIn("active task", pending_discard)

            component.claim_task(task.id, owner="alice")
            progress_normal = component.remove_worktree("auth")
            progress_discard = component.remove_worktree(
                "auth", discard_changes=True
            )

            self.assertIn("active task", progress_normal)
            self.assertIn("active task", progress_discard)
            self.assertTrue(worktree.exists())
            self.assertEqual(component.load_task(task.id).status, "in_progress")


if __name__ == "__main__":
    unittest.main()
