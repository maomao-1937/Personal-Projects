from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_application_serves_static_site_index(tmp_path):
    (tmp_path / "index.html").write_text("<h1>MeetingMemo</h1>", encoding="utf-8")
    settings = Settings(_env_file=None, app_env="test", static_site_dir=tmp_path)

    with TestClient(create_app(settings=settings, start_runner=False)) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "MeetingMemo" in response.text


def test_application_keeps_api_routes_when_static_site_is_enabled(tmp_path):
    (tmp_path / "index.html").write_text("<h1>MeetingMemo</h1>", encoding="utf-8")
    settings = Settings(_env_file=None, app_env="test", static_site_dir=tmp_path)

    with TestClient(create_app(settings=settings, start_runner=False)) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
