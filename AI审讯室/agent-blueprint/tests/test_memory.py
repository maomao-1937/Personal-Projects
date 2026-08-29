import importlib.util
import os
import sys
import tempfile
import time
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "s09_memory" / "code.py"


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
    module_name = f"memory_test_{time.time_ns()}"
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


def test_memory_slug_normalizes_names() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        assert component.memory_slug("User Prefs") == "user-prefs"
        assert component.memory_slug("  Already--Clean  ") == "already-clean"
        assert component.memory_slug("!!!") == "memory"


def test_memory_path_rejects_escape_and_index() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        with pytest.raises(ValueError, match="not a memory record"):
            component.memory_path("MEMORY.md")
        with pytest.raises(ValueError, match="Invalid memory filename"):
            component.memory_path("../outside.md")
        with pytest.raises(ValueError, match="Invalid memory filename"):
            component.memory_path("sub/dir.md")


def test_write_memory_rebuilds_index_and_reads_back() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        component.write_memory_file(
            "user-prefs", "user", "User prefers tabs", "Use tabs for indentation."
        )

        index = component.read_memory_index()
        assert "[user-prefs](user-prefs.md) - User prefers tabs" in index

        assert component.read_memory_file("user-prefs.md").startswith("---")
        assert component.read_memory_file("missing.md") is None

        records = component.list_memory_files()
        assert len(records) == 1
        assert records[0]["name"] == "user-prefs"
        assert records[0]["type"] == "user"
        assert records[0]["body"] == "Use tabs for indentation."


def test_should_store_memory_filters_temporary_and_duplicates() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        durable = {
            "scope": "persistent",
            "type": "user",
            "name": "tabs",
            "description": "indentation",
            "body": "Use tabs",
        }
        assert component.should_store_memory(durable, []) is True

        assert component.should_store_memory(
            {**durable, "scope": "current_task"}, []
        ) is False
        assert component.should_store_memory(
            {**durable, "type": "unknown"}, []
        ) is False
        assert component.should_store_memory(
            {**durable, "name": ""}, []
        ) is False
        assert component.should_store_memory(
            {**durable, "body": "Use tabs for this session"}, []
        ) is False
        assert component.should_store_memory(
            durable,
            [{"name": "TABS", "description": "other", "body": "other"}],
        ) is False


def test_memory_document_roundtrips_through_frontmatter() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        doc = component.memory_document(
            "user-prefs", "user", "Indentation", "Use tabs"
        )
        metadata, body = component.parse_frontmatter(doc)
        assert metadata["name"] == "user-prefs"
        assert metadata["type"] == "user"
        assert metadata["description"] == "Indentation"
        assert body.strip() == "Use tabs"


def test_parse_frontmatter_returns_original_on_invalid() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        assert component.parse_frontmatter("plain text") == ({}, "plain text")
        invalid_mapping = "---\n- not\n- a mapping\n---\nBody"
        assert component.parse_frontmatter(invalid_mapping) == (
            {},
            invalid_mapping,
        )


def test_extract_json_array_recovers_from_prefix_text() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        assert component.extract_json_array("Here you go: [0, 2]") == [0, 2]
        assert component.extract_json_array("[0, 2]") == [0, 2]
        assert component.extract_json_array("no array here") == []
        assert component.extract_json_array("[1, [2, 3]]") == [1, [2, 3]]


def test_keyword_memory_selection_ranks_by_words() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        records = [
            {"filename": "a.md", "name": "tabs", "description": "indentation"},
            {"filename": "b.md", "name": "spaces", "description": "indentation"},
        ]
        assert component.keyword_memory_selection(
            records, "please use tabs", 5
        ) == ["a.md"]


def test_validate_memory_record_requires_fields() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        valid = {
            "name": "tabs",
            "type": "user",
            "description": "indent",
            "body": "Use tabs",
            "scope": "persistent",
        }
        assert component.validate_memory_record(valid)["name"] == "tabs"
        assert (
            component.validate_memory_record(valid, require_scope=True)
            is not None
        )
        assert component.validate_memory_record({"name": "x"}) is None
        assert (
            component.validate_memory_record(
                {**valid, "scope": "bogus"}, require_scope=True
            )
            is None
        )
        assert (
            component.validate_memory_record({**valid, "type": "unknown"})
            is None
        )


def test_build_system_includes_catalog_and_recalled() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        component.write_memory_file("tabs", "user", "Indentation", "Use tabs")
        system = component.build_system(
            '[{"source": "tabs.md", "content": "Use tabs"}]'
        )
        assert "Memory catalog:" in system
        assert "Relevant memory records:" in system
        assert "tabs" in system


def test_load_memories_returns_empty_without_records() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        assert (
            component.load_memories([{"role": "user", "content": "hello"}])
            == ""
        )


def test_select_relevant_memories_uses_model_selection() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        component.write_memory_file("tabs", "user", "Indentation", "Use tabs")

        class FakeResponse:
            content = [{"type": "text", "text": "[0]"}]

        component.client.messages.create = lambda **_: FakeResponse()
        selected = component.select_relevant_memories(
            [{"role": "user", "content": "indent with tabs"}]
        )
        assert selected == ["tabs.md"]


def test_select_relevant_memories_falls_back_to_keywords() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        component = load_component(Path(tmp))
        component.write_memory_file("tabs", "user", "Indentation", "Use tabs")
        component.write_memory_file("spaces", "user", "Spacing", "Use spaces")

        def boom(**kwargs):
            raise RuntimeError("api down")

        component.client.messages.create = boom
        selected = component.select_relevant_memories(
            [{"role": "user", "content": "please use tabs"}]
        )
        assert selected == ["tabs.md"]
