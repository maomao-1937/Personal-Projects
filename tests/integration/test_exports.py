from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest

from backend.config import FFMPEG_BIN
from backend.jobs.handlers import HandlerRegistry
from backend.jobs.service import JobService
from backend.jobs.worker import JobWorker
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.providers.protocols import AudioAnalysisResult, EnergyPoint, OnsetPoint
from backend.providers.render_ffmpeg import FFmpegRenderProvider, RenderCut, RenderMetadata
from backend.services.projects import ProjectService
from backend.services.rendering import ExportRenderHandler, RenderingService
from backend.services.timelines import TimelineService
from backend.storage.local_artifacts import LocalArtifactStore


class FakeRenderProvider:
    def __init__(self) -> None:
        self.calls = 0

    def render_preview(self, *, output_path, width, height, **_) -> RenderMetadata:
        self.calls += 1
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"rendered-mp4")
        return RenderMetadata(
            duration_ms=2_000,
            width=width,
            height=height,
            video_codec="h264",
            audio_codec="aac",
            placeholder_cut_ids=[],
        )


@pytest.fixture
def export_scenario(tmp_path):
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    project = repositories.projects.create(user.id, "MV")
    _seed(database, project.id)
    projects = ProjectService(repositories.projects)
    timelines = TimelineService(database, projects)
    rendering = RenderingService(database, projects, timelines, JobService(database))
    return database, timelines, rendering, user.id, project.id


def test_landscape_success_does_not_mark_portrait_ready(export_scenario) -> None:
    database, _, rendering, owner_id, project_id = export_scenario
    landscape = rendering.create_export(
        owner_id,
        project_id,
        aspect_ratio="16:9",
        idempotency_key="export-landscape",
    )
    with database.transaction() as connection:
        connection.execute(
            "UPDATE exports SET status = 'ready', artifact_id = 'art_0' WHERE id = ?",
            (landscape.id,),
        )

    assert rendering.export_status(owner_id, project_id, "16:9").status == "ready"
    assert rendering.export_status(owner_id, project_id, "9:16").status == "not_created"


def test_timeline_change_makes_old_export_stale_despite_existing_artifact(export_scenario) -> None:
    database, timelines, rendering, owner_id, project_id = export_scenario
    old = rendering.create_export(
        owner_id,
        project_id,
        aspect_ratio="16:9",
        idempotency_key="export-old",
    )
    with database.transaction() as connection:
        connection.execute(
            "UPDATE exports SET status = 'ready', artifact_id = 'art_0' WHERE id = ?",
            (old.id,),
        )
        connection.execute("UPDATE cuts SET active_artifact_id = 'art_1' WHERE id = 'cut_0'")

    timelines.build_current(owner_id, project_id)

    with database.connect() as connection:
        stale = connection.execute(
            "SELECT status, artifact_id, stale_reason FROM exports WHERE id = ?", (old.id,)
        ).fetchone()
    assert tuple(stale) == ("stale", "art_0", "timeline_changed")
    assert rendering.export_status(owner_id, project_id, "16:9").status == "not_created"


def test_failed_export_can_queue_new_job_for_same_timeline_and_ratio(export_scenario) -> None:
    database, _, rendering, owner_id, project_id = export_scenario
    failed = rendering.create_export(
        owner_id,
        project_id,
        aspect_ratio="16:9",
        idempotency_key="export-first-attempt",
    )
    with database.transaction() as connection:
        connection.execute("UPDATE exports SET status = 'failed' WHERE id = ?", (failed.id,))

    retried = rendering.create_export(
        owner_id,
        project_id,
        aspect_ratio="16:9",
        idempotency_key="export-second-attempt",
    )

    assert retried.id == failed.id
    assert retried.job_id != failed.job_id
    assert retried.status == "queued"


def test_portrait_export_is_deterministic_center_crop(tmp_path) -> None:
    audio = tmp_path / "audio.wav"
    video = tmp_path / "landscape.mp4"
    output = tmp_path / "portrait.mp4"
    _run([FFMPEG_BIN, "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", str(audio)])
    _run(
        [
            FFMPEG_BIN,
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=s=320x180:r=30:d=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(video),
        ]
    )

    metadata = FFmpegRenderProvider().render_preview(
        audio_path=audio,
        cuts=[RenderCut(cut_id="cut_1", duration_ms=1_000, video_path=video)],
        output_path=output,
        width=180,
        height=320,
    )

    assert (metadata.width, metadata.height) == (180, 320)
    assert metadata.video_codec == "h264"
    assert metadata.audio_codec == "aac"


@pytest.mark.asyncio
async def test_export_handler_replay_reuses_completed_artifact(tmp_path) -> None:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    project = repositories.projects.create(user.id, "MV")
    _seed(database, project.id)
    jobs = JobService(database)
    projects = ProjectService(repositories.projects)
    timelines = TimelineService(database, projects)
    rendering = RenderingService(database, projects, timelines, jobs)
    export = rendering.create_export(
        user.id,
        project.id,
        aspect_ratio="16:9",
        idempotency_key="export-replay",
    )
    provider = FakeRenderProvider()
    handler = ExportRenderHandler(
        database,
        jobs,
        LocalArtifactStore(tmp_path / "artifacts"),
        provider,
    )
    registry = HandlerRegistry()
    registry.register("export_render", handler)

    await JobWorker(jobs, registry, worker_id="export-worker").run_once()
    await handler(jobs.get(export.job_id))

    with database.connect() as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM artifacts WHERE type = 'export'"
        ).fetchone()[0] == 1
    assert provider.calls == 1


def _seed(database: Database, project_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    analysis = AudioAnalysisResult(
        duration_ms=2_000,
        bpm=120,
        beats_ms=[500, 1_000, 1_500],
        downbeats_ms=[1_000],
        onsets=[OnsetPoint(time_ms=500, strength=1)],
        energy_curve=[EnergyPoint(time_ms=0, value=0.5)],
        waveform=[0.1],
        algorithm_version="test",
    )
    with database.transaction() as connection:
        for artifact_id, artifact_type in (
            ("art_audio", "audio"),
            ("art_0", "video"),
            ("art_1", "video"),
        ):
            connection.execute(
                "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (artifact_id, project_id, artifact_type, f"{artifact_id}.bin", "{}", "ready", None, now),
            )
        connection.execute(
            "INSERT INTO audio_assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("aud_1", project_id, "art_audio", 1, "sum", 2_000, "analyzed", 1, now),
        )
        connection.execute(
            "INSERT INTO audio_analyses VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("ana_1", "aud_1", 1, analysis.model_dump_json(), "ready", None, now),
        )
        connection.execute(
            "INSERT INTO storyboards VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("stb_1", project_id, 1, json.dumps({"beat_plan": {"version": 1}}), "confirmed", None, now),
        )
        for index in range(2):
            connection.execute(
                "INSERT INTO cuts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    f"cut_{index}",
                    "stb_1",
                    1,
                    index,
                    index * 1_000,
                    (index + 1) * 1_000,
                    json.dumps({"prompt": "test"}),
                    f"art_{index}",
                    "ready",
                    now,
                ),
            )


def _run(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr[-1_000:]
