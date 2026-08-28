from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.providers.protocols import AudioAnalysisResult, EnergyPoint, OnsetPoint
from backend.services.projects import ProjectService
from backend.services.timelines import TimelineService


@pytest.fixture
def scenario(tmp_path):
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    project = repositories.projects.create(user.id, "MV")
    _seed_timeline_inputs(database, project.id)
    service = TimelineService(database, ProjectService(repositories.projects))
    return database, service, user.id, project.id


def test_prompt_draft_change_does_not_create_timeline_version(scenario) -> None:
    database, service, owner_id, project_id = scenario
    first = service.build_current(owner_id, project_id)
    with database.transaction() as connection:
        spec = json.loads(connection.execute("SELECT spec_json FROM cuts WHERE id = 'cut_0'").fetchone()[0])
        spec["prompt"] = "只修改尚未生成的新 Prompt"
        connection.execute(
            "UPDATE cuts SET spec_json = ?, cut_version = cut_version + 1 WHERE id = 'cut_0'",
            (json.dumps(spec, sort_keys=True),),
        )

    second = service.build_current(owner_id, project_id)

    assert second.id == first.id
    assert second.version == 1


def test_active_artifact_order_and_time_changes_create_new_versions(scenario) -> None:
    database, service, owner_id, project_id = scenario
    versions = [service.build_current(owner_id, project_id)]
    now = datetime.now(timezone.utc).isoformat()
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("art_new", project_id, "video", "new.mp4", "{}", "ready", None, now),
        )
        connection.execute("UPDATE cuts SET active_artifact_id = 'art_new' WHERE id = 'cut_0'")
    versions.append(service.build_current(owner_id, project_id))

    with database.transaction() as connection:
        connection.execute("UPDATE cuts SET order_index = 99 WHERE id = 'cut_0'")
        connection.execute("UPDATE cuts SET order_index = 0, start_ms = 0, end_ms = 5000 WHERE id = 'cut_1'")
        connection.execute("UPDATE cuts SET order_index = 1, start_ms = 5000, end_ms = 10000 WHERE id = 'cut_0'")
    versions.append(service.build_current(owner_id, project_id))

    with database.transaction() as connection:
        connection.execute("UPDATE cuts SET end_ms = 4500 WHERE order_index = 0")
        connection.execute("UPDATE cuts SET start_ms = 4500 WHERE order_index = 1")
    versions.append(service.build_current(owner_id, project_id))

    assert [version.version for version in versions] == [1, 2, 3, 4]
    assert len({version.content_hash for version in versions}) == 4


def test_new_timeline_marks_old_preview_and_exports_stale_even_with_artifacts(scenario) -> None:
    database, service, owner_id, project_id = scenario
    first = service.build_current(owner_id, project_id)
    now = datetime.now(timezone.utc).isoformat()
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO previews VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("prv_1", project_id, first.id, "full", "ready", None, "art_0", None, now),
        )
        for ratio, export_id in (("16:9", "exp_landscape"), ("9:16", "exp_portrait")):
            connection.execute(
                "INSERT INTO exports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (export_id, project_id, first.id, ratio, "1080p", "ready", None, "art_0", None, now, now),
            )
        connection.execute("UPDATE cuts SET active_artifact_id = 'art_1' WHERE id = 'cut_0'")

    current = service.build_current(owner_id, project_id)

    assert current.id != first.id
    with database.connect() as connection:
        preview = connection.execute(
            "SELECT status, artifact_id, stale_reason FROM previews WHERE id = 'prv_1'"
        ).fetchone()
        exports = connection.execute(
            "SELECT status, artifact_id, stale_reason FROM exports ORDER BY id"
        ).fetchall()
    assert tuple(preview) == ("stale", "art_0", "timeline_changed")
    assert [tuple(row) for row in exports] == [
        ("stale", "art_0", "timeline_changed"),
        ("stale", "art_0", "timeline_changed"),
    ]


def _seed_timeline_inputs(database: Database, project_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    analysis = AudioAnalysisResult(
        duration_ms=30_000,
        bpm=120,
        beats_ms=list(range(500, 30_000, 500)),
        downbeats_ms=list(range(2_000, 30_000, 2_000)),
        onsets=[OnsetPoint(time_ms=500, strength=1)],
        energy_curve=[EnergyPoint(time_ms=0, value=0.5)],
        waveform=[0.1, 0.2],
        algorithm_version="test",
    )
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("art_audio", project_id, "audio", "audio.wav", "{}", "ready", None, now),
        )
        connection.execute(
            "INSERT INTO audio_assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("aud_1", project_id, "art_audio", 1, "sum", 30_000, "analyzed", 1, now),
        )
        connection.execute(
            "INSERT INTO audio_analyses VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("ana_1", "aud_1", 1, analysis.model_dump_json(), "ready", None, now),
        )
        connection.execute(
            "INSERT INTO storyboards VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("stb_1", project_id, 1, json.dumps({"beat_plan": {"version": 1}}), "confirmed", None, now),
        )
        for index in range(6):
            artifact_id = f"art_{index}"
            connection.execute(
                "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (artifact_id, project_id, "video", f"{index}.mp4", "{}", "ready", None, now),
            )
            connection.execute(
                "INSERT INTO cuts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    f"cut_{index}",
                    "stb_1",
                    1,
                    index,
                    index * 5_000,
                    (index + 1) * 5_000,
                    json.dumps({"prompt": f"镜头 {index}"}),
                    artifact_id,
                    "ready",
                    now,
                ),
            )
