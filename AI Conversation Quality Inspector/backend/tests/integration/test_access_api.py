from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import TEST_INVITE
from tests.support import StaticModel


def test_valid_invite_sets_httponly_cookie(client: TestClient) -> None:
    response = client.post("/api/v1/access/redeem", json={"code": TEST_INVITE})

    assert response.status_code == 200
    assert response.json()["remaining_uses"] == 50
    assert response.json()["csrf_token"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]


def test_invalid_invite_uses_stable_safe_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/access/redeem",
        json={"code": "wrong_invite_1234567890"},
    )

    assert response.status_code == 401
    payload = response.json()["error"]
    assert payload["code"] == "INVITE_CODE_INVALID"
    assert payload["request_id"]
    assert "traceback" not in response.text.lower()


def test_access_status_uses_signed_cookie(access_client) -> None:
    client, csrf_token = access_client

    response = client.get("/api/v1/access/status")

    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    assert response.json()["remaining_uses"] == 50
    assert response.json()["csrf_token"] == csrf_token


def test_tampered_cookie_is_rejected(client: TestClient) -> None:
    client.cookies.set("aqi_access", "tampered")

    response = client.get("/api/v1/access/status")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "ACCESS_TOKEN_INVALID"


def test_health_and_public_config_are_available_without_invite(
    client: TestClient,
) -> None:
    live = client.get("/health/live")
    ready = client.get("/health/ready")
    public_config = client.get("/api/v1/public/config")

    assert live.status_code == 200
    assert ready.status_code == 200
    assert ready.json()["database_ready"] is True
    assert ready.json()["backup_ready"] is True
    assert ready.json()["llm_configured"] is True
    assert public_config.json()["max_transcript_chars"] == 12_000
    assert live.headers["x-content-type-options"] == "nosniff"
    assert live.headers["referrer-policy"] == "no-referrer"


def test_validation_error_never_echoes_submitted_value(client: TestClient) -> None:
    secret_marker = "PRIVATE_TRANSCRIPT_MARKER"

    response = client.post(
        "/api/v1/access/redeem",
        json={"code": secret_marker * 30},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert secret_marker not in response.text


def test_ready_reports_missing_llm_without_failing_startup(test_settings) -> None:
    settings_without_llm = test_settings.model_copy(update={"llm_api_key": None, "llm_model": ""})
    app = create_app(settings_without_llm, model_client=StaticModel())

    with TestClient(app) as local_client:
        response = local_client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["llm_configured"] is False


def test_request_body_limit_returns_safe_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/access/redeem",
        content=b"x" * 131_073,
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"
