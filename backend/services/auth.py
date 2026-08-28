from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from backend.domain.errors import DomainError
from backend.domain.models import User
from backend.persistence.database import Database


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AuthService:
    def __init__(self, database: Database, *, session_ttl_seconds: int = 604800) -> None:
        self.database = database
        self.session_ttl_seconds = session_ttl_seconds

    def add_invite_code(self, plaintext: str, *, max_uses: int = 1) -> None:
        if not plaintext:
            raise ValueError("invite code cannot be empty")
        with self.database.transaction() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO invite_codes(
                    code_hash, status, expires_at, max_uses, used_count
                ) VALUES (?, 'active', NULL, ?, 0)
                """,
                (_hash(plaintext), max_uses),
            )

    def add_invite_code_hash(self, code_hash: str, *, max_uses: int = 100) -> None:
        normalized = code_hash.strip().lower()
        if len(normalized) != 64 or any(character not in "0123456789abcdef" for character in normalized):
            raise ValueError("invite code hash must be a SHA-256 hex digest")
        with self.database.transaction() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO invite_codes(
                    code_hash, status, expires_at, max_uses, used_count
                ) VALUES (?, 'active', NULL, ?, 0)
                """,
                (normalized, max_uses),
            )

    def login(self, plaintext: str) -> tuple[User, str]:
        now = _now()
        code_hash = _hash(plaintext)
        token = secrets.token_urlsafe(32)
        token_hash = _hash(token)
        user_id = f"usr_{secrets.token_hex(8)}"
        created_at = now.isoformat()
        expires_at = (now + timedelta(seconds=self.session_ttl_seconds)).isoformat()
        with self.database.transaction() as connection:
            invite = connection.execute(
                """
                SELECT * FROM invite_codes
                WHERE code_hash = ? AND status = 'active'
                  AND (expires_at IS NULL OR expires_at > ?)
                  AND used_count < max_uses
                """,
                (code_hash, created_at),
            ).fetchone()
            if invite is None:
                raise DomainError(
                    code="invalid_invite_code",
                    message="邀请码无效或已失效。",
                    status_code=401,
                )
            connection.execute(
                "UPDATE invite_codes SET used_count = used_count + 1 WHERE code_hash = ?",
                (code_hash,),
            )
            connection.execute(
                "INSERT INTO users(id, status, created_at) VALUES (?, 'active', ?)",
                (user_id, created_at),
            )
            connection.execute(
                """
                INSERT INTO sessions(token_hash, user_id, expires_at, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (token_hash, user_id, expires_at, created_at),
            )
        return User(id=user_id, status="active", created_at=created_at), token

    def authenticate(self, token: str) -> User:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT users.* FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
                  AND users.status = 'active'
                """,
                (_hash(token), _now().isoformat()),
            ).fetchone()
        if row is None:
            raise DomainError("authentication_required", "登录已失效。", status_code=401)
        return User(id=row["id"], status=row["status"], created_at=row["created_at"])

    def authenticate_bearer(self, authorization: str | None) -> User:
        if not authorization or not authorization.startswith("Bearer "):
            raise DomainError("authentication_required", "请先登录。", status_code=401)
        return self.authenticate(authorization.removeprefix("Bearer ").strip())
