from __future__ import annotations

import io
import wave

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.audio import build_audio_router
from backend.api.audio_analysis import build_audio_analysis_router
from backend.api.auth import build_auth_router
from backend.api.errors import install_error_handlers
from backend.api.projects import build_projects_router
from backend.jobs.handlers import HandlerRegistry
from backend.jobs.service import JobService
from backend.jobs.worker import JobWorker
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.providers.protocols import AudioAnalysisResult, EnergyPoint, OnsetPoint
from backend.services.audio import AudioService
from backend.services.audio_analysis import AudioAnalysisHandler, AudioAnalysisService
from backend.services.auth import AuthService
from backend.services.projects import ProjectService
from backend.storage.local_artifacts import LocalArtifactStore


class FakeAudioProvider:
    def analyze(self, audio_path, *, sensitivity):
        assert audio_path.is_file()
        return AudioAnalysisResult(
            duration_ms=30_000,
            bpm=120,
            beats_ms=[500, 1_000],
            downbeats_ms=[1_000],
            onsets=[OnsetPoint(time_ms=500, strength=1)],
            energy_curve=[EnergyPoint(time_ms=0, value=0.5)],
            waveform=[0.1],
            algorithm_version="fake",
        )


@pytest.mark.asyncio
async def test_audio_analysis_runs_as_persisted_job_and_is_available_afterward(tmp_path) -> None:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    auth = AuthService(database)
    projects = ProjectService(repositories.projects)
    artifacts = LocalArtifactStore(tmp_path / "artifacts")
    jobs = JobService(database)
    uploads = AudioService(
        database,
        projects,
        artifacts,
        max_bytes=100 * 1024 * 1024,
        min_seconds=30,
        max_seconds=60,
    )
    analyses = AudioAnalysisService(database, projects, jobs)
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(build_auth_router(auth))
    app.include_router(build_projects_router(projects, auth))
    app.include_router(build_audio_router(uploads, auth))
    app.include_router(build_audio_analysis_router(analyses, auth))
    client = TestClient(app)
    auth.add_invite_code("invite")
    token = client.post("/api/v1/auth/invite", json={"invite_code": "invite"}).json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project_id = client.post("/api/v1/projects", json={"name": "MV"}, headers=headers).json()["id"]
    client.post(
        f"/api/v1/projects/{project_id}/audio",
        headers=headers,
        files={"audio": ("song.wav", _silent_wav(30), "audio/wav")},
    )

    response = client.post(
        f"/api/v1/projects/{project_id}/audio/analysis",
        headers={**headers, "Idempotency-Key": "analyze-song"},
    )
    registry = HandlerRegistry()
    registry.register(
        "audio_analysis",
        AudioAnalysisHandler(database, jobs, artifacts, FakeAudioProvider()),
    )
    await JobWorker(jobs, registry, worker_id="audio-worker").run_once()
    result = client.get(f"/api/v1/projects/{project_id}/audio/analysis", headers=headers)

    assert response.status_code == 202
    assert jobs.get(response.json()["id"]).status == "succeeded"
    assert result.status_code == 200
    assert result.json()["status"] == "ready"
    assert result.json()["result"]["bpm"] == 120


def _silent_wav(seconds: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(8_000)
        output.writeframes(b"\0\0" * 8_000 * seconds)
    return buffer.getvalue()
