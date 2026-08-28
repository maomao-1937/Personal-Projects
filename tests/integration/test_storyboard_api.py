from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.auth import build_auth_router
from backend.api.errors import install_error_handlers
from backend.api.projects import build_projects_router
from backend.api.storyboards import build_storyboards_router
from backend.domain.errors import DomainError
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.providers.protocols import AudioAnalysisResult, EnergyPoint, OnsetPoint
from backend.services.auth import AuthService
from backend.services.projects import ProjectService
from backend.services.storyboards import PlotSpec, StoryboardCutDraft, StoryboardDraft, StoryboardService


class FakeStoryboardProvider:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail

    def generate(self, *, creative_brief, audio_summary, beat_plan):
        if self.fail:
            raise DomainError(
                "storyboard_invalid_response",
                "模型未返回合法分镜。",
                status_code=502,
                retryable=True,
            )
        return StoryboardDraft(
            plot=PlotSpec(
                theme="追光",
                visual_arc="从黑夜走到黎明",
                emotional_arc="克制到释放",
                visual_style="电影感",
            ),
            cuts=[
                StoryboardCutDraft(
                    prompt=f"镜头 {index + 1}",
                    mood="坚定",
                    camera="推进",
                    action="向前奔跑",
                )
                for index in range(len(beat_plan.segments))
            ],
        )


def _analysis() -> AudioAnalysisResult:
    return AudioAnalysisResult(
        duration_ms=30_000,
        bpm=120,
        beats_ms=list(range(500, 30_000, 500)),
        downbeats_ms=list(range(2_000, 30_000, 2_000)),
        onsets=[OnsetPoint(time_ms=value, strength=1) for value in range(500, 30_000, 500)],
        energy_curve=[EnergyPoint(time_ms=value, value=0.5) for value in range(0, 30_000, 500)],
        waveform=[0],
        algorithm_version="test",
    )


def _scenario(tmp_path, provider) -> tuple[TestClient, Database, str, dict[str, str]]:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    auth = AuthService(database)
    projects = ProjectService(repositories.projects)
    service = StoryboardService(database, projects, provider, max_cut_count=12)
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(build_auth_router(auth))
    app.include_router(build_projects_router(projects, auth))
    app.include_router(build_storyboards_router(service, auth))
    client = TestClient(app)
    auth.add_invite_code("invite-a")
    token = client.post("/api/v1/auth/invite", json={"invite_code": "invite-a"}).json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project_id = client.post("/api/v1/projects", json={"name": "MV"}, headers=headers).json()["id"]
    _persist_analysis(database, project_id)
    return client, database, project_id, headers


def _persist_analysis(database: Database, project_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("art_audio", project_id, "audio", f"{project_id}/audio.wav", "{}", "ready", None, now),
        )
        connection.execute(
            "INSERT INTO audio_assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("aud_1", project_id, "art_audio", 1, "checksum", 30_000, "analyzed", 1, now),
        )
        connection.execute(
            "INSERT INTO audio_analyses VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("ana_1", "aud_1", 1, _analysis().model_dump_json(), "ready", None, now),
        )


def test_storyboard_api_persists_normalized_storyboard_and_cuts(tmp_path) -> None:
    client, database, project_id, headers = _scenario(tmp_path, FakeStoryboardProvider())

    response = client.post(
        f"/api/v1/projects/{project_id}/storyboards",
        headers=headers,
        json={"creative_brief": "一场城市追光之旅"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "draft"
    assert payload["cuts"][0]["start_ms"] == 0
    assert payload["cuts"][-1]["end_ms"] == 30_000
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM storyboards").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM cuts").fetchone()[0] == len(payload["cuts"])


def test_invalid_provider_result_does_not_save_partial_storyboard(tmp_path) -> None:
    client, database, project_id, headers = _scenario(tmp_path, FakeStoryboardProvider(fail=True))

    response = client.post(
        f"/api/v1/projects/{project_id}/storyboards",
        headers=headers,
        json={"creative_brief": "测试"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "storyboard_invalid_response"
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM storyboards").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM cuts").fetchone()[0] == 0


def test_storyboard_can_be_confirmed_before_cut_generation(tmp_path) -> None:
    client, database, project_id, headers = _scenario(tmp_path, FakeStoryboardProvider())
    created = client.post(
        f"/api/v1/projects/{project_id}/storyboards",
        headers=headers,
        json={"creative_brief": "追光"},
    ).json()

    response = client.post(
        f"/api/v1/projects/{project_id}/storyboards/{created['id']}/confirm",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
    with database.connect() as connection:
        assert connection.execute(
            "SELECT status FROM storyboards WHERE id = ?", (created["id"],)
        ).fetchone()[0] == "confirmed"
