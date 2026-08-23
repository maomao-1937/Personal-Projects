from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.access.models import AccessSession, InviteCode
from app.access.service import AccessService
from app.meetings.models import AuditEvent


def test_redeem_sets_http_only_cookie(client, invite_code):
    response = client.post("/api/v1/access/redeem", json={"invite_code": invite_code})

    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert response.json()["remaining_redemptions"] == 49
    assert response.json()["expires_at"]


def test_invite_plaintext_is_not_stored(invite_code, session_factory):
    with session_factory() as session:
        stored = session.scalar(select(InviteCode))

    assert stored is not None
    assert stored.code_hash != invite_code
    assert len(stored.code_hash) == 64


def test_refresh_does_not_consume_another_redemption(client, invite_code, session_factory):
    client.post("/api/v1/access/redeem", json={"invite_code": invite_code})

    assert client.get("/api/v1/access/session").status_code == 200
    assert client.get("/api/v1/access/session").status_code == 200
    with session_factory() as session:
        stored = session.scalar(select(InviteCode))
        assert stored is not None
        assert stored.redemption_count == 1


def test_logout_revokes_session(client, invite_code, session_factory):
    client.post("/api/v1/access/redeem", json={"invite_code": invite_code})

    logout = client.post("/api/v1/access/logout")

    assert logout.status_code == 204
    assert client.get("/api/v1/access/session").status_code == 401
    with session_factory() as session:
        stored = session.scalar(select(AccessSession))
        assert stored is not None
        assert stored.revoked_at is not None


def test_invalid_expired_and_exhausted_invites_share_public_error(
    client, settings, session_factory
):
    service = AccessService(settings, session_factory)
    service.create_invite(
        label="expired",
        max_redemptions=50,
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
        code="MM-EXPIRED-ACCESS-CODE",
    )
    service.create_invite(
        label="one-use",
        max_redemptions=1,
        code="MM-ONE-USE-ACCESS-CODE",
    )
    assert (
        client.post(
            "/api/v1/access/redeem", json={"invite_code": "MM-ONE-USE-ACCESS-CODE"}
        ).status_code
        == 200
    )

    responses = [
        client.post("/api/v1/access/redeem", json={"invite_code": "MM-NOT-REAL-CODE"}),
        client.post("/api/v1/access/redeem", json={"invite_code": "MM-EXPIRED-ACCESS-CODE"}),
        client.post("/api/v1/access/redeem", json={"invite_code": "MM-ONE-USE-ACCESS-CODE"}),
    ]

    assert {(item.status_code, item.json()["error"]["code"]) for item in responses} == {
        (403, "INVITE_INVALID")
    }
    with session_factory() as session:
        events = list(
            session.scalars(
                select(AuditEvent).where(
                    AuditEvent.action == "invite_redeem",
                    AuditEvent.result == "failed",
                )
            )
        )
    assert {event.details["reason"] for event in events} >= {
        "not_found",
        "expired",
        "exhausted",
    }


def test_session_token_plaintext_is_not_stored(client, invite_code, session_factory):
    response = client.post("/api/v1/access/redeem", json={"invite_code": invite_code})
    token = response.cookies["meetingmemo_session"]

    with session_factory() as session:
        stored = session.scalar(select(AccessSession))

    assert stored is not None
    assert stored.token_hash != token
    assert len(stored.token_hash) == 64


def test_invite_cannot_be_created_above_fifty_redemptions(settings, session_factory):
    service = AccessService(settings, session_factory)

    with pytest.raises(ValueError, match="between 1 and 50"):
        service.create_invite(label="too-large", max_redemptions=51)
