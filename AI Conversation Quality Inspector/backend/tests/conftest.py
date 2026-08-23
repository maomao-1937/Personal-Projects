from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.support import StaticModel

TEST_INVITE = "pilot_test_invite_1234567890"


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    return Settings(
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'api.db'}",
        session_secret="s" * 32,
        invite_code_pepper="p" * 32,
        invite_codes=TEST_INVITE,
        invite_usage_limit=50,
        llm_api_key="test-key",
        llm_model="fake-model-v1",
        allowed_origins="http://localhost:3010",
    )


@pytest.fixture
def client(test_settings: Settings) -> Generator[TestClient, None, None]:
    app = create_app(test_settings, model_client=StaticModel())
    with TestClient(app, base_url="http://testserver") as test_client:
        yield test_client


@pytest.fixture
def access_client(client: TestClient) -> tuple[TestClient, str]:
    response = client.post("/api/v1/access/redeem", json={"code": TEST_INVITE})
    assert response.status_code == 200
    return client, response.json()["csrf_token"]
