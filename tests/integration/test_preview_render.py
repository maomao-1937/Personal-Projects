from __future__ import annotations

import subprocess
import json
from datetime import datetime, timezone

import pytest

from backend.config import FFMPEG_BIN
from backend.jobs.handlers import HandlerRegistry
from backend.jobs.service import JobService
from backend.jobs.worker import JobWorker
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.providers.protocols import AudioAnalysisResult, EnergyPoint, OnsetPoint
from backend.providers.render_ffmpeg import FFmpegRenderProvider, RenderCut
from backend.services.projects import ProjectService
from backend.services.rendering import PreviewRenderHandler, RenderingService
from backend.services.timelines import TimelineService
from backend.storage.local_artifacts import LocalArtifactStore


@pytest.fixture
def fixed_media(tmp_path):
    audio = tmp_path / "audio.wav"
    red = tmp_path / "red.mp4"
    blue = tmp_path / "blue.mp4"
    _run(
        [
            FFMPEG_BIN,
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=2",
            "-c:a",
            "pcm_s16le",
            str(audio),
        ]
    )
    for path, color in ((red, "red"), (blue, "blue")):
        _run(
            [
                FFMPEG_BIN,
                "-y",
                "-f",
                "lavfi",
                "-i",
                f"color=c={color}:s=320x180:r=30:d=1",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                str(path),
            ]
        )
    return audio, red, blue


def test_ffmpeg_preview_is_h264_aac_and_matches_timeline_duration(fixed_media, tmp_path) -> None:
    audio, red, blue = fixed_media
    output = tmp_path / "preview.mp4"
    provider = FFmpegRenderProvider()

    metadata = provider.render_preview(
        audio_path=audio,
        cuts=[
            RenderCut(cut_id="cut_1", duration_ms=1_000, video_path=red),
            RenderCut(cut_id="cut_2", duration_ms=1_000, video_path=blue),
        ],
        output_path=output,
        width=320,
        height=180,
    )

    assert output.is_file()
    assert metadata.video_codec == "h264"
    assert metadata.audio_codec == "aac"
    assert metadata.width == 320
    assert metadata.height == 180
    assert metadata.duration_ms == pytest.approx(2_000, abs=500)


def test_partial_preview_renders_placeholder_without_hiding_missing_cut(fixed_media, tmp_path) -> None:
    audio, red, _ = fixed_media
    output = tmp_path / "partial.mp4"

    metadata = FFmpegRenderProvider().render_preview(
        audio_path=audio,
        cuts=[
            RenderCut(cut_id="cut_1", duration_ms=1_000, video_path=red),
            RenderCut(cut_id="cut_2", duration_ms=1_000, video_path=None),
        ],
        output_path=output,
        width=320,
        height=180,
    )

    assert metadata.duration_ms == pytest.approx(2_000, abs=500)
    assert metadata.placeholder_cut_ids == ["cut_2"]


@pytest.mark.asyncio
async def test_preview_job_persists_verified_artifact_for_exact_timeline(fixed_media, tmp_path) -> None:
    audio, red, blue = fixed_media
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    project = repositories.projects.create(user.id, "MV")
    artifacts = LocalArtifactStore(tmp_path / "artifacts")
    audio_file = artifacts.put_bytes(f"{project.id}/audio.wav", audio.read_bytes())
    red_file = artifacts.put_bytes(f"{project.id}/red.mp4", red.read_bytes())
    blue_file = artifacts.put_bytes(f"{project.id}/blue.mp4", blue.read_bytes())
    _seed_render_inputs(database, project.id, audio_file.key, red_file.key, blue_file.key)
    jobs = JobService(database)
    projects = ProjectService(repositories.projects)
    timelines = TimelineService(database, projects)
    rendering = RenderingService(database, projects, timelines, jobs)
    preview = rendering.create_preview(
        user.id,
        project.id,
        idempotency_key="preview-current",
    )
    registry = HandlerRegistry()
    handler = PreviewRenderHandler(
        database,
        jobs,
        artifacts,
        FFmpegRenderProvider(),
        width=320,
        height=180,
    )
    registry.register("preview_render", handler)

    await JobWorker(jobs, registry, worker_id="render-worker").run_once()

    with database.connect() as connection:
        row = connection.execute("SELECT * FROM previews WHERE id = ?", (preview.id,)).fetchone()
        artifact = connection.execute(
            "SELECT * FROM artifacts WHERE id = ?", (row["artifact_id"],)
        ).fetchone()
    assert row["status"] == "ready"
    assert row["timeline_version_id"] == preview.timeline_version_id
    assert artifact["status"] == "ready"
    output_path = artifacts.resolve(artifact["storage_key"])
    metadata = FFmpegRenderProvider().probe(output_path)
    assert metadata.duration_ms == pytest.approx(2_000, abs=500)

    await handler(jobs.get(preview.job_id))
    with database.connect() as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM artifacts WHERE type = 'preview'"
        ).fetchone()[0] == 1


def _run(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr[-1_000:]


def _seed_render_inputs(
    database: Database,
    project_id: str,
    audio_key: str,
    red_key: str,
    blue_key: str,
) -> None:
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
        for artifact_id, artifact_type, key in (
            ("art_audio", "audio", audio_key),
            ("art_red", "video", red_key),
            ("art_blue", "video", blue_key),
        ):
            connection.execute(
                "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (artifact_id, project_id, artifact_type, key, "{}", "ready", None, now),
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
        for index, artifact_id in enumerate(("art_red", "art_blue")):
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
                    artifact_id,
                    "ready",
                    now,
                ),
            )
