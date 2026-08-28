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
    assert "/api/process" in schema["paths"]
    assert settings.app_database_path.is_file()
    assert app.state.recovered_jobs == 0
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
    assert "React" not in response.text
