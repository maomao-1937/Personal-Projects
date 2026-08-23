from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.errors import DomainError
from app.core.security import fingerprint_value
from app.meetings.models import Feedback
from app.summaries.models import Delivery


@dataclass
class RecordingProvider:
    configured: bool = True
    target_identity: str = "recording-default"
    sends: int = 0

    def send(self, content: str) -> dict[str, object]:
        self.sends += 1
        assert "Meeting" in content or "会议" in content
        return {"provider_message_id": "recorded-1"}


class FailingProvider:
    configured = True

    def send(self, content: str) -> dict[str, object]:
        raise DomainError("DELIVERY_FAILED", "分发服务暂时不可用", 502)


def approved_summary(app, auth_client) -> tuple[str, str]:
    meeting = auth_client.post("/api/v1/meetings", json={"title": "Integration Meeting"}).json()
    meeting_id = meeting["id"]
    auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript",
        json={"text": "Alice: 确认发布。\n\nBob: 我来准备公告。"},
    )
    auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")
    app.state.job_runner.run_once()
    summary = auth_client.get(f"/api/v1/meetings/{meeting_id}/summaries").json()["items"][0]
    approved = auth_client.post(f"/api/v1/summaries/{summary['id']}/approve")
    assert approved.status_code == 200
    return meeting_id, summary["id"]


def test_integrations_report_disabled_without_secrets(auth_client):
    response = auth_client.get("/api/v1/integrations")

    assert response.status_code == 200
    payload = response.json()
    assert payload["slack"]["status"] == "not_configured"
    assert payload["email"]["status"] == "not_configured"
    assert payload["zoom"]["status"] == "not_configured"
    assert payload["google_meet"]["status"] == "not_configured"


def test_unapproved_summary_cannot_be_delivered(app, auth_client):
    meeting = auth_client.post("/api/v1/meetings", json={"title": "Unapproved Meeting"}).json()
    auth_client.post(
        f"/api/v1/meetings/{meeting['id']}/transcript",
        json={"text": "Alice: 确认发布。"},
    )
    auth_client.post(f"/api/v1/meetings/{meeting['id']}/summary-jobs")
    app.state.job_runner.run_once()
    summary = auth_client.get(f"/api/v1/meetings/{meeting['id']}/summaries").json()["items"][0]

    response = auth_client.post(
        f"/api/v1/summaries/{summary['id']}/deliveries",
        json={"channel": "slack", "target": "configured-default"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SUMMARY_NOT_APPROVED"


def test_duplicate_delivery_returns_same_record_and_sends_once(app, auth_client):
    _, summary_id = approved_summary(app, auth_client)
    provider = RecordingProvider()
    app.state.delivery_providers["slack"] = provider
    payload = {"channel": "slack", "target": "configured-default"}

    first = auth_client.post(f"/api/v1/summaries/{summary_id}/deliveries", json=payload)
    second = auth_client.post(f"/api/v1/summaries/{summary_id}/deliveries", json=payload)

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["status"] == "succeeded"
    assert provider.sends == 1


def test_delivery_failure_is_persisted_with_safe_error(app, auth_client):
    _, summary_id = approved_summary(app, auth_client)
    app.state.delivery_providers["slack"] = FailingProvider()

    response = auth_client.post(
        f"/api/v1/summaries/{summary_id}/deliveries",
        json={"channel": "slack", "target": "configured-default"},
    )

    assert response.status_code == 502
    repeated = auth_client.post(
        f"/api/v1/summaries/{summary_id}/deliveries",
        json={"channel": "slack", "target": "configured-default"},
    )
    assert repeated.status_code == 200
    assert repeated.json()["status"] == "failed"
    assert repeated.json()["error"]["code"] == "DELIVERY_FAILED"


def test_feedback_stores_only_explicit_fields(app, auth_client, session_factory):
    meeting_id, summary_id = approved_summary(app, auth_client)

    response = auth_client.post(
        "/api/v1/feedback",
        json={
            "meeting_id": meeting_id,
            "summary_version_id": summary_id,
            "rating": 4,
            "error_types": ["missing_action"],
            "comment": "漏掉了一个次要跟进项。",
        },
    )

    assert response.status_code == 201
    with session_factory() as session:
        stored = session.scalar(select(Feedback))
    assert stored is not None
    assert stored.rating == 4
    assert stored.comment == "漏掉了一个次要跟进项。"
    assert not hasattr(stored, "transcript")


def test_feedback_rejects_unknown_error_type(auth_client):
    response = auth_client.post(
        "/api/v1/feedback",
        json={"rating": 3, "error_types": ["invented_error_type"]},
    )

    assert response.status_code == 422


def test_approved_summary_becomes_undeliverable_after_new_revision(app, auth_client):
    _, summary_id = approved_summary(app, auth_client)
    original = auth_client.get(f"/api/v1/summaries/{summary_id}").json()
    revised = original["content"] | {"headline": "New latest revision"}
    created = auth_client.post(
        f"/api/v1/summaries/{summary_id}/revisions",
        json={"expected_version": 1, "content": revised},
    )
    assert created.status_code == 201
    app.state.delivery_providers["slack"] = RecordingProvider()

    response = auth_client.post(
        f"/api/v1/summaries/{summary_id}/deliveries",
        json={"channel": "slack", "target": "configured-default"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SUMMARY_NOT_LATEST"


def test_delivery_target_change_creates_a_new_idempotency_scope(app, auth_client):
    _, summary_id = approved_summary(app, auth_client)
    first_provider = RecordingProvider(target_identity="destination-a")
    app.state.delivery_providers["slack"] = first_provider
    payload = {"channel": "slack", "target": "configured-default"}
    first = auth_client.post(f"/api/v1/summaries/{summary_id}/deliveries", json=payload)
    second_provider = RecordingProvider(target_identity="destination-b")
    app.state.delivery_providers["slack"] = second_provider
    second = auth_client.post(f"/api/v1/summaries/{summary_id}/deliveries", json=payload)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert first_provider.sends == 1
    assert second_provider.sends == 1


def test_stale_pending_delivery_becomes_unknown_without_resending(
    app, auth_client, settings, session_factory
):
    _, summary_id = approved_summary(app, auth_client)
    provider = RecordingProvider(target_identity="destination-a")
    app.state.delivery_providers["slack"] = provider
    target_fingerprint = fingerprint_value(
        "delivery-target", provider.target_identity, settings.secret_key
    )
    idempotency_key = fingerprint_value(
        "delivery",
        f"{summary_id}:slack:{target_fingerprint}",
        settings.secret_key,
    )
    with session_factory.begin() as session:
        session.add(
            Delivery(
                summary_version_id=summary_id,
                channel="slack",
                target_fingerprint=target_fingerprint,
                idempotency_key=idempotency_key,
                status="pending",
                receipt={},
                created_at=datetime.now(UTC)
                - timedelta(seconds=settings.delivery_pending_timeout_seconds + 1),
            )
        )

    response = auth_client.post(
        f"/api/v1/summaries/{summary_id}/deliveries",
        json={"channel": "slack", "target": "configured-default"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "unknown"
    assert response.json()["error"]["code"] == "DELIVERY_STATUS_UNKNOWN"
    assert provider.sends == 0
