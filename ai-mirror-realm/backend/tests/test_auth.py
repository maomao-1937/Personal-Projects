from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, event, inspect, text

from app.config import settings
from app.config.settings import Settings
from app.models.user import User
from conftest import issue_invitation, register_user


def test_registration_requires_an_invitation(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "no-invite@example.com",
            "password": "password123",
            "nickname": "测试用户",
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_registration_sets_session_cookie_and_me_uses_it(client, db_session_factory):
    invite_token = issue_invitation(db_session_factory)

    response = client.post(
        "/api/auth/register",
        json={
            "email": "cookie@example.com",
            "password": "password123",
            "nickname": "镜界访客",
            "invite_token": invite_token,
        },
    )

    assert response.status_code == 201
    assert "access_token" not in response.json()
    assert settings.AUTH_COOKIE_NAME in response.cookies
    set_cookie = response.headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "cookie@example.com"


def test_logout_clears_cookie_and_session(client, db_session_factory):
    register_user(client, db_session_factory, email="logout@example.com")

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_login_sets_cookie_for_returning_invited_user(client, db_session_factory):
    register_user(client, db_session_factory, email="returning@example.com")
    client.post("/api/auth/logout")

    response = client.post(
        "/api/auth/login",
        json={"account": "returning@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    assert "access_token" not in response.json()
    assert settings.AUTH_COOKIE_NAME in response.cookies
    assert client.get("/api/auth/me").status_code == 200


def test_uninvited_user_cannot_use_protected_product_api(
    client, db_session_factory
):
    from app.services.auth_service import create_access_token, hash_password

    with db_session_factory() as db:
        user = User(
            email="uninvited@example.com",
            password_hash=hash_password("password123"),
            nickname="未受邀用户",
            invited_at=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user.id)

    response = client.post(
        "/api/uploads/selfie",
        files={"file": ("selfie.jpg", b"test-image", "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "INVITE_REQUIRED"


def test_legacy_user_migration_adds_and_backfills_invited_at(tmp_path):
    from app.services.invitation_service import ensure_invitation_schema

    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR,
                    password_hash VARCHAR NOT NULL,
                    nickname VARCHAR NOT NULL,
                    is_active BOOLEAN
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, nickname, is_active)
                VALUES ('legacy-user', 'legacy@example.com', 'hash', '旧用户', 1)
                """
            )
        )

    ensure_invitation_schema(engine)

    assert "invited_at" in {column["name"] for column in inspect(engine).get_columns("users")}
    with engine.connect() as connection:
        invited_at = connection.execute(
            text("SELECT invited_at FROM users WHERE id = 'legacy-user'")
        ).scalar_one()
    assert invited_at is not None


def test_legacy_backfill_recovers_after_column_was_added_before_failure(tmp_path):
    """A prior run may persist ALTER TABLE but fail before legacy backfill."""
    from app.services.invitation_service import ensure_invitation_schema

    engine = create_engine(f"sqlite:///{tmp_path / 'half-migrated.db'}")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR,
                    password_hash VARCHAR NOT NULL,
                    nickname VARCHAR NOT NULL,
                    is_active BOOLEAN,
                    invited_at DATETIME
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO users
                    (id, email, password_hash, nickname, is_active, invited_at)
                VALUES
                    ('legacy-user', 'legacy@example.com', 'hash', '旧用户', 1, NULL)
                """
            )
        )

    ensure_invitation_schema(engine)

    with engine.connect() as connection:
        legacy_invited_at = connection.execute(
            text("SELECT invited_at FROM users WHERE id = 'legacy-user'")
        ).scalar_one()
        migration_count = connection.execute(
            text(
                "SELECT COUNT(*) FROM schema_migrations "
                "WHERE name = 'invite_legacy_backfill_v1'"
            )
        ).scalar_one()
    assert legacy_invited_at is not None
    assert migration_count == 1

    # A user created after the completed migration must remain uninvited on restart.
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO users
                    (id, email, password_hash, nickname, is_active, invited_at)
                VALUES
                    ('later-user', 'later@example.com', 'hash', '后来用户', 1, NULL)
                """
            )
        )
    ensure_invitation_schema(engine)
    with engine.connect() as connection:
        later_invited_at = connection.execute(
            text("SELECT invited_at FROM users WHERE id = 'later-user'")
        ).scalar_one()
    assert later_invited_at is None


def test_legacy_backfill_retries_after_injected_update_failure(tmp_path):
    from app.services.invitation_service import ensure_invitation_schema

    engine = create_engine(f"sqlite:///{tmp_path / 'retry-migration.db'}")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR,
                    password_hash VARCHAR NOT NULL,
                    nickname VARCHAR NOT NULL,
                    is_active BOOLEAN
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, nickname, is_active)
                VALUES ('legacy-user', 'legacy@example.com', 'hash', '旧用户', 1)
                """
            )
        )

    def fail_backfill(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith("UPDATE users SET invited_at"):
            raise RuntimeError("injected legacy backfill failure")

    event.listen(engine, "before_cursor_execute", fail_backfill)
    with pytest.raises(RuntimeError, match="injected legacy backfill failure"):
        ensure_invitation_schema(engine)
    event.remove(engine, "before_cursor_execute", fail_backfill)

    ensure_invitation_schema(engine)

    with engine.connect() as connection:
        invited_at = connection.execute(
            text("SELECT invited_at FROM users WHERE id = 'legacy-user'")
        ).scalar_one()
        migration_count = connection.execute(
            text(
                "SELECT COUNT(*) FROM schema_migrations "
                "WHERE name = 'invite_legacy_backfill_v1'"
            )
        ).scalar_one()
    assert invited_at is not None
    assert migration_count == 1


def test_non_debug_settings_require_secure_auth_cookie():
    with pytest.raises(ValidationError, match="AUTH_COOKIE_SECURE"):
        Settings(DEBUG=False, AUTH_COOKIE_SECURE=False, _env_file=None)

    production = Settings(DEBUG=False, AUTH_COOKIE_SECURE=True, _env_file=None)
    assert production.AUTH_COOKIE_SECURE is True

    development = Settings(DEBUG=True, AUTH_COOKIE_SECURE=False, _env_file=None)
    assert development.AUTH_COOKIE_SECURE is False
