from pathlib import Path

from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from alembic import command
from app.core.config import Settings
from app.main import create_app


def test_live_health(client):
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "meetingmemo-api"}


def test_ready_health(client):
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "service": "meetingmemo-api"}


def test_ready_health_fails_when_database_is_unavailable(app, client):
    class UnavailableEngine:
        def connect(self):
            raise OperationalError("SELECT 1", {}, OSError("database unavailable"))

    app.state.engine = UnavailableEngine()

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "NOT_READY"


def test_ready_health_fails_when_required_runner_is_not_alive(app, client):
    app.state.start_runner = True

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "NOT_READY"


def test_ready_health_fails_when_database_migrations_are_missing(tmp_path: Path):
    settings = Settings(
        _env_file=None,
        app_env="development",
        database_url=f"sqlite:///{tmp_path / 'unmigrated.db'}",
        secret_key="test-secret-key-with-at-least-32-bytes",
    )
    app = create_app(settings=settings, start_runner=False)

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "NOT_READY"


def test_ready_health_accepts_current_database_revision(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'migrated.db'}"
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")
    settings = Settings(
        _env_file=None,
        app_env="development",
        database_url=database_url,
        secret_key="test-secret-key-with-at-least-32-bytes",
    )
    app = create_app(settings=settings, start_runner=False)

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200


def test_unknown_route_uses_error_envelope(client):
    response = client.get("/api/v1/missing")

    assert response.status_code == 404
    assert set(response.json()["error"]) == {"code", "message", "trace_id"}
    assert response.json()["error"]["code"] == "NOT_FOUND"
