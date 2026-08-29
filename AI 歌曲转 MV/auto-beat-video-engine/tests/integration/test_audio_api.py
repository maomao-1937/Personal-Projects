import io
import wave

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.audio import build_audio_router
from backend.api.auth import build_auth_router
from backend.api.errors import install_error_handlers
from backend.api.projects import build_projects_router
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.services.audio import AudioService
from backend.services.auth import AuthService
from backend.services.projects import ProjectService
from backend.storage.local_artifacts import LocalArtifactStore


def _silent_wav(seconds: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(8000)
        output.writeframes(b"\0\0" * 8000 * seconds)
    return buffer.getvalue()


def _scenario(tmp_path) -> tuple[TestClient, str, str]:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    auth = AuthService(database)
    projects = ProjectService(repositories.projects)
    audio = AudioService(
        database,
        projects,
        LocalArtifactStore(tmp_path / "artifacts"),
        max_bytes=100 * 1024 * 1024,
        min_seconds=30,
        max_seconds=60,
    )
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(build_auth_router(auth))
    app.include_router(build_projects_router(projects, auth))
    app.include_router(build_audio_router(audio, auth))
    client = TestClient(app)
    auth.add_invite_code("invite-a")
    token = client.post("/api/v1/auth/invite", json={"invite_code": "invite-a"}).json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project_id = client.post("/api/v1/projects", json={"name": "MV"}, headers=headers).json()["id"]
    return client, token, project_id


def test_upload_rejects_audio_shorter_than_thirty_seconds(tmp_path) -> None:
    client, token, project_id = _scenario(tmp_path)

    response = client.post(
        f"/api/v1/projects/{project_id}/audio",
        headers={"Authorization": f"Bearer {token}"},
        files={"audio": ("short.wav", _silent_wav(1), "audio/wav")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "audio_duration_out_of_range"


def test_upload_persists_valid_audio_metadata(tmp_path) -> None:
    client, token, project_id = _scenario(tmp_path)

    response = client.post(
        f"/api/v1/projects/{project_id}/audio",
        headers={"Authorization": f"Bearer {token}"},
        files={"audio": ("song.wav", _silent_wav(30), "audio/wav")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["project_id"] == project_id
    assert payload["duration_ms"] == 30_000
    assert payload["status"] == "uploaded"
