from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.access.service import AccessService
from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'meetingmemo-test.db'}",
        frontend_origin="http://localhost:3000",
        secret_key="test-secret-key-with-at-least-32-bytes",
        upload_dir=tmp_path / "uploads",
        llm_provider="mock",
    )


@pytest.fixture
def app(settings: Settings):
    return create_app(settings=settings, start_runner=False)


@pytest.fixture
def session_factory(app) -> sessionmaker[Session]:
    return app.state.session_factory


@pytest.fixture
def invite_code(settings: Settings, session_factory: sessionmaker[Session]) -> str:
    code = "MM-TEST-ACCESS-CODE"
    AccessService(settings, session_factory).create_invite(
        label="pytest",
        max_redemptions=50,
        code=code,
    )
    return code


@pytest.fixture
def client(app) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_client(client: TestClient, invite_code: str) -> TestClient:
    response = client.post("/api/v1/access/redeem", json={"invite_code": invite_code})
    assert response.status_code == 200
    return client
