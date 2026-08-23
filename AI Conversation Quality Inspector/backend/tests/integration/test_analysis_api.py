from uuid import uuid4

from tests.support import VALID_TRANSCRIPT


class UnhealthyBackup:
    def is_healthy(self, *, max_age_seconds: int) -> bool:
        return False


def analysis_payload(transcript: str = VALID_TRANSCRIPT) -> dict[str, str]:
    return {"qa_type": "sales", "transcript": transcript}


def test_missing_csrf_is_rejected(access_client) -> None:
    client, _ = access_client

    response = client.post(
        "/api/v1/analyses",
        json=analysis_payload(),
        headers={"Idempotency-Key": str(uuid4())},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_INVALID"


def test_successful_analysis_consumes_one_use(access_client) -> None:
    client, csrf_token = access_client

    response = client.post(
        "/api/v1/analyses",
        json=analysis_payload(),
        headers={
            "Idempotency-Key": str(uuid4()),
            "X-CSRF-Token": csrf_token,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["remaining_uses"] == 49
    assert payload["analysis_status"] == "scored"
    assert payload["scored_dimension_count"] == 6
    assert len(payload["dimensions"]) == 6


def test_duplicate_idempotency_key_returns_conflict(access_client) -> None:
    client, csrf_token = access_client
    request_id = str(uuid4())
    headers = {"Idempotency-Key": request_id, "X-CSRF-Token": csrf_token}

    first = client.post("/api/v1/analyses", json=analysis_payload(), headers=headers)
    second = client.post("/api/v1/analyses", json=analysis_payload(), headers=headers)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    status = client.get("/api/v1/access/status")
    assert status.json()["remaining_uses"] == 49


def test_invalid_transcript_does_not_consume_quota(access_client) -> None:
    client, csrf_token = access_client

    response = client.post(
        "/api/v1/analyses",
        json=analysis_payload("客户：你好"),
        headers={
            "Idempotency-Key": str(uuid4()),
            "X-CSRF-Token": csrf_token,
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "TRANSCRIPT_TOO_SHORT"
    status = client.get("/api/v1/access/status")
    assert status.json()["remaining_uses"] == 50


def test_malformed_idempotency_key_is_validation_error(access_client) -> None:
    client, csrf_token = access_client

    response = client.post(
        "/api/v1/analyses",
        json=analysis_payload(),
        headers={"Idempotency-Key": "not-a-uuid", "X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_leaving_access_clears_cookie(access_client) -> None:
    client, csrf_token = access_client

    leave = client.delete(
        "/api/v1/access",
        headers={"X-CSRF-Token": csrf_token},
    )
    status = client.get("/api/v1/access/status")

    assert leave.status_code == 200
    assert leave.json()["cleared"] is True
    assert status.status_code == 401


def test_unhealthy_backup_blocks_quota_writes(access_client) -> None:
    client, csrf_token = access_client
    client.app.state.runtime.backup_service = UnhealthyBackup()

    ready = client.get("/health/ready")

    response = client.post(
        "/api/v1/analyses",
        json=analysis_payload(),
        headers={
            "Idempotency-Key": str(uuid4()),
            "X-CSRF-Token": csrf_token,
        },
    )

    assert ready.status_code == 503
    assert ready.json()["backup_ready"] is False
    assert ready.json()["status"] == "degraded"
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "BACKUP_UNAVAILABLE"
    status = client.get("/api/v1/access/status")
    assert status.json()["remaining_uses"] == 50
