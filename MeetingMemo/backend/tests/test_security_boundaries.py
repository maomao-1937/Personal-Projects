import logging
from pathlib import Path

import anyio
from sqlalchemy import select

from app.core.config import Settings
from app.main import create_app
from app.meetings.models import AuditEvent
from app.summaries.models import SummaryVersion


def test_protected_api_rejects_missing_session(client):
    response = client.get("/api/v1/meetings")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "ACCESS_REQUIRED"


def test_state_change_rejects_foreign_origin(auth_client):
    response = auth_client.post(
        "/api/v1/meetings",
        headers={"Origin": "https://attacker.example"},
        json={"title": "Secret meeting"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_FORBIDDEN"


def test_state_change_accepts_configured_origin(auth_client):
    response = auth_client.post(
        "/api/v1/meetings",
        headers={"Origin": "http://localhost:3000"},
        json={"title": "Expected origin"},
    )

    assert response.status_code == 201


def test_request_logs_do_not_contain_secret_or_transcript(caplog, client, invite_code):
    transcript = "quarterly confidential numbers 90000001"
    caplog.set_level(logging.INFO, logger="meetingmemo.http")
    redeemed = client.post(
        "/api/v1/access/redeem",
        json={"invite_code": invite_code},
    )
    assert redeemed.status_code == 200
    meeting = client.post("/api/v1/meetings", json={"title": "Logging boundary"}).json()
    uploaded = client.post(
        f"/api/v1/meetings/{meeting['id']}/transcript",
        json={"text": transcript},
    )
    assert uploaded.status_code == 200

    rendered = "\n".join(record.getMessage() for record in caplog.records)
    assert invite_code not in rendered
    assert transcript not in rendered
    assert "meetingmemo_session" not in rendered
    assert '"path"' in rendered
    assert '"status_code"' in rendered


def test_redeem_rate_limit_stores_only_ip_fingerprint(client, session_factory):
    for _ in range(20):
        response = client.post(
            "/api/v1/access/redeem",
            json={"invite_code": "MM-INVALID-CODE"},
        )
        assert response.status_code == 403

    blocked = client.post(
        "/api/v1/access/redeem",
        json={"invite_code": "MM-INVALID-CODE"},
    )

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"
    with session_factory() as session:
        events = list(
            session.scalars(select(AuditEvent).where(AuditEvent.action == "invite_redeem"))
        )
    assert len(events) == 21
    assert all(event.session_fingerprint for event in events)
    assert all("testclient" not in event.session_fingerprint for event in events)
    assert all("MM-INVALID-CODE" not in str(event.details) for event in events)


def test_deleting_queued_meeting_prevents_summary_creation(app, auth_client, session_factory):
    meeting = auth_client.post("/api/v1/meetings", json={"title": "Delete race"}).json()
    auth_client.post(
        f"/api/v1/meetings/{meeting['id']}/transcript",
        json={"text": "Alice: 不应生成摘要。"},
    )
    job = auth_client.post(f"/api/v1/meetings/{meeting['id']}/summary-jobs").json()

    deleted = auth_client.delete(f"/api/v1/meetings/{meeting['id']}")
    ran = app.state.job_runner.run_once()

    assert deleted.status_code == 204
    assert ran is False
    assert auth_client.get(f"/api/v1/jobs/{job['id']}").status_code == 404
    with session_factory() as session:
        summaries = list(
            session.scalars(
                select(SummaryVersion).where(SummaryVersion.meeting_id == meeting["id"])
            )
        )
    assert summaries == []


def test_streamed_request_without_content_length_is_still_bounded(tmp_path: Path):
    settings = Settings(
        _env_file=None,
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'stream-limit.db'}",
        secret_key="test-secret-key-with-at-least-32-bytes",
        max_request_bytes=2048,
    )
    fastapi_app = create_app(settings=settings, start_runner=False)

    async def scenario():
        messages = iter(
            [
                {"type": "http.request", "body": b"x" * 1500, "more_body": True},
                {"type": "http.request", "body": b"y" * 1500, "more_body": False},
            ]
        )
        sent = []

        async def receive():
            return next(messages)

        async def send(message):
            sent.append(message)

        await fastapi_app(
            {
                "type": "http",
                "http_version": "1.1",
                "method": "POST",
                "scheme": "http",
                "path": "/api/v1/meetings",
                "raw_path": b"/api/v1/meetings",
                "query_string": b"",
                "headers": [(b"content-type", b"application/json")],
                "client": ("127.0.0.1", 1234),
                "server": ("test", 80),
                "state": {"trace_id": "stream-test"},
            },
            receive,
            send,
        )
        return sent

    sent = anyio.run(scenario)
    fastapi_app.state.engine.dispose()

    start = next(item for item in sent if item["type"] == "http.response.start")
    assert start["status"] == 413
    body = b"".join(item.get("body", b"") for item in sent).decode()
    assert "REQUEST_TOO_LARGE" in body
