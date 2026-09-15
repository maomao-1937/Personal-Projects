from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from app.models.invitation import InvitationToken
from conftest import issue_invitation


def registration_payload(email: str, invite_token: str) -> dict:
    return {
        "email": email,
        "password": "password123",
        "nickname": "受邀用户",
        "invite_token": invite_token,
    }


def test_valid_invitation_is_redeemed_once(client, db_session_factory):
    invite_token = issue_invitation(db_session_factory, label="首批测试")

    first = client.post(
        "/api/auth/register",
        json=registration_payload("first@example.com", invite_token),
    )
    second = client.post(
        "/api/auth/register",
        json=registration_payload("second@example.com", invite_token),
    )

    assert first.status_code == 201
    assert first.json()["user"]["invited_at"] is not None
    assert second.status_code == 403
    assert second.json()["code"] == "INVITE_UNAVAILABLE"

    with db_session_factory() as db:
        invitation = db.query(InvitationToken).one()
        assert invitation.redeemed_at is not None
        assert invitation.redeemed_by_user_id == first.json()["user"]["id"]
        assert invitation.token_digest != invite_token


def test_invalid_invitation_uses_generic_error(client):
    response = client.post(
        "/api/auth/register",
        json=registration_payload("invalid@example.com", "not-a-real-token"),
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "邀请码无效或已失效",
        "code": "INVITE_UNAVAILABLE",
    }


def test_expired_invitation_is_rejected(client, db_session_factory):
    invite_token = issue_invitation(
        db_session_factory,
        expires_at=datetime.utcnow() - timedelta(seconds=1),
    )

    response = client.post(
        "/api/auth/register",
        json=registration_payload("expired@example.com", invite_token),
    )

    assert response.status_code == 403
    assert response.json()["code"] == "INVITE_UNAVAILABLE"


def test_revoked_invitation_is_rejected(client, db_session_factory):
    from app.services.invitation_service import revoke_invitation

    invite_token = issue_invitation(db_session_factory)
    with db_session_factory() as db:
        invitation = db.query(InvitationToken).one()
        assert revoke_invitation(db, invitation.id)
        db.commit()

    response = client.post(
        "/api/auth/register",
        json=registration_payload("revoked@example.com", invite_token),
    )

    assert response.status_code == 403
    assert response.json()["code"] == "INVITE_UNAVAILABLE"


def test_duplicate_account_does_not_consume_invitation(client, db_session_factory):
    first_token = issue_invitation(db_session_factory, label="first")
    assert client.post(
        "/api/auth/register",
        json=registration_payload("duplicate@example.com", first_token),
    ).status_code == 201

    second_token = issue_invitation(db_session_factory, label="second")
    duplicate = client.post(
        "/api/auth/register",
        json=registration_payload("duplicate@example.com", second_token),
    )
    replacement = client.post(
        "/api/auth/register",
        json=registration_payload("replacement@example.com", second_token),
    )

    assert duplicate.status_code == 400
    assert replacement.status_code == 201


def test_concurrent_redemption_allows_only_one_registration(
    client, db_session_factory
):
    invite_token = issue_invitation(db_session_factory)

    def register(email: str):
        # A separate client per thread avoids sharing a mutable cookie jar.
        from fastapi.testclient import TestClient
        from app.main import app

        thread_client = TestClient(app)
        try:
            return thread_client.post(
                "/api/auth/register",
                json=registration_payload(email, invite_token),
            ).status_code
        finally:
            thread_client.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(
            executor.map(register, ["race-a@example.com", "race-b@example.com"])
        )

    assert sorted(statuses) == [201, 403]
