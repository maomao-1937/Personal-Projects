from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config import Settings
from backend.version import APP_VERSION


def test_app_factory_starts_migrations_and_registers_new_and_legacy_routes(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        app_env="test",
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
        storyboard_api_key=None,
        video_api_key=None,
    )
    app = create_app(settings)

    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        schema = client.get("/openapi.json").json()

    assert health.status_code == 200
    assert health.json()["version"] == APP_VERSION
    assert "/api/v1/projects" in schema["paths"]
    assert "/api/v1/projects/{project_id}/storyboard-jobs" in schema["paths"]
    assert "/api/v1/projects/{project_id}/storyboards/latest" in schema["paths"]
    assert "/api/v1/projects/{project_id}/storyboards" not in schema["paths"]
    assert "/api/v1/projects/{project_id}/timeline" in schema["paths"]
    assert "/api/process" in schema["paths"]
    assert settings.app_database_path.is_file()
    assert app.state.recovered_jobs == 0
    assert app.state.expired_artifacts == 0
    assert app.state.worker_count == 2


def test_acceptance_page_is_minimal_server_rendered_harness(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        app_env="test",
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
    )

    with TestClient(create_app(settings)) as client:
        response = client.get("/acceptance")

    assert response.status_code == 200
    assert "后端最小验收" in response.text
    assert "上传音频" in response.text
    assert "生成 Storyboard" in response.text
    assert "/storyboard-jobs" in response.text
    assert "/storyboards/latest" in response.text
    assert "watchJob" in response.text
    assert "downloadArtifact" in response.text
    assert 'id="downloads"' in response.text
    assert 'id="previewPlayer"' in response.text
    assert "React" not in response.text


def test_job_status_is_owner_scoped_in_assembled_app(tmp_path) -> None:
    settings = Settings(
        _env_file=None,
        app_env="test",
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
    )
    app = create_app(settings)
    with TestClient(app) as client:
        auth = app.state.services["auth"]
        auth.add_invite_code("invite-a")
        auth.add_invite_code("invite-b")
        token_a = client.post("/api/v1/auth/invite", json={"invite_code": "invite-a"}).json()["session_token"]
        token_b = client.post("/api/v1/auth/invite", json={"invite_code": "invite-b"}).json()["session_token"]
        project_id = client.post(
            "/api/v1/projects",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"name": "Private"},
        ).json()["id"]
        job = app.state.jobs.create("audio_analysis", project_id, {}, "private-job")

        anonymous = client.get(f"/api/v1/jobs/{job.id}")
        other_user = client.get(
            f"/api/v1/jobs/{job.id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )

    assert anonymous.status_code == 401
    assert other_user.status_code == 404
