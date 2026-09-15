from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy import Engine, inspect, or_, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.invitation import InvitationToken

LEGACY_BACKFILL_MIGRATION = "invite_legacy_backfill_v1"


def _pepper() -> bytes:
    # A dedicated pepper is preferred; falling back to the JWT key keeps local
    # development usable without storing plaintext invitation tokens.
    return (settings.INVITE_TOKEN_PEPPER or settings.SECRET_KEY).encode("utf-8")


def digest_invitation_token(raw_token: str) -> str:
    normalized = raw_token.strip()
    return hmac.new(_pepper(), normalized.encode("utf-8"), hashlib.sha256).hexdigest()


def create_invitation(
    db: Session,
    *,
    label: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> Tuple[str, InvitationToken]:
    raw_token = f"mirror_{secrets.token_urlsafe(24)}"
    invitation = InvitationToken(
        token_digest=digest_invitation_token(raw_token),
        token_hint=raw_token[-4:],
        label=label,
        expires_at=expires_at,
    )
    db.add(invitation)
    db.flush()
    return raw_token, invitation


def redeem_invitation(
    db: Session,
    *,
    raw_token: str,
    user_id: str,
    now: Optional[datetime] = None,
) -> bool:
    redeemed_at = now or datetime.utcnow()
    updated = (
        db.query(InvitationToken)
        .filter(
            InvitationToken.token_digest == digest_invitation_token(raw_token),
            InvitationToken.redeemed_at.is_(None),
            InvitationToken.revoked_at.is_(None),
            or_(
                InvitationToken.expires_at.is_(None),
                InvitationToken.expires_at > redeemed_at,
            ),
        )
        .update(
            {
                InvitationToken.redeemed_at: redeemed_at,
                InvitationToken.redeemed_by_user_id: user_id,
            },
            synchronize_session=False,
        )
    )
    return updated == 1


def revoke_invitation(
    db: Session,
    invitation_id: str,
    *,
    now: Optional[datetime] = None,
) -> bool:
    revoked_at = now or datetime.utcnow()
    updated = (
        db.query(InvitationToken)
        .filter(
            InvitationToken.id == invitation_id,
            InvitationToken.revoked_at.is_(None),
            InvitationToken.redeemed_at.is_(None),
        )
        .update(
            {InvitationToken.revoked_at: revoked_at},
            synchronize_session=False,
        )
    )
    return updated == 1


def ensure_invitation_schema(engine: Engine) -> None:
    """Apply the one compatible SQLite migration required by invite-only auth.

    ``create_all`` cannot add a column to an existing users table. The column
    addition and grandfathering happen only when the column is first created,
    so a later uninvited user cannot become invited just by restarting the app.
    """

    inspector = inspect(engine)
    if "users" in set(inspector.get_table_names()):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS schema_migrations ("
                    "name VARCHAR PRIMARY KEY, "
                    "applied_at DATETIME NOT NULL"
                    ")"
                )
            )

            user_columns = {
                column["name"] for column in inspect(connection).get_columns("users")
            }
            if "invited_at" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN invited_at DATETIME"))

            backfill_completed = connection.execute(
                text("SELECT 1 FROM schema_migrations WHERE name = :name"),
                {"name": LEGACY_BACKFILL_MIGRATION},
            ).scalar_one_or_none()
            if backfill_completed is None:
                connection.execute(
                    text(
                        "UPDATE users SET invited_at = CURRENT_TIMESTAMP "
                        "WHERE invited_at IS NULL"
                    )
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_users_invited_at "
                        "ON users (invited_at)"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO schema_migrations (name, applied_at) "
                        "VALUES (:name, CURRENT_TIMESTAMP)"
                    ),
                    {"name": LEGACY_BACKFILL_MIGRATION},
                )

    InvitationToken.__table__.create(bind=engine, checkfirst=True)
