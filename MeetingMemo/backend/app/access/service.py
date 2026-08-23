from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import case, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session, sessionmaker

from app.access.models import AccessSession, InviteCode, InviteRateLimitBucket
from app.core.config import Settings
from app.core.errors import DomainError
from app.core.security import (
    fingerprint_value,
    generate_invite_code,
    generate_session_token,
    hash_invite_code,
    hash_session_token,
    normalize_invite_code,
)
from app.meetings.models import AuditEvent


@dataclass(frozen=True, slots=True)
class CreatedInvite:
    id: str
    code: str


@dataclass(frozen=True, slots=True)
class RedeemedSession:
    token: str
    session_id: str
    expires_at: datetime
    remaining_redemptions: int


class AccessService:
    def __init__(
        self,
        settings: Settings,
        session_factory: sessionmaker[Session],
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory

    def create_invite(
        self,
        *,
        label: str,
        max_redemptions: int = 50,
        expires_at: datetime | None = None,
        code: str | None = None,
    ) -> CreatedInvite:
        if not 1 <= max_redemptions <= 50:
            raise ValueError("max_redemptions must be between 1 and 50")
        plaintext = normalize_invite_code(code or generate_invite_code())
        invite = InviteCode(
            code_hash=hash_invite_code(plaintext, self.settings.secret_key),
            label=label.strip(),
            max_redemptions=max_redemptions,
            expires_at=expires_at,
        )
        with self.session_factory.begin() as session:
            session.add(invite)
            session.flush()
            invite_id = invite.id
        return CreatedInvite(id=invite_id, code=plaintext)

    def deactivate_invite(self, invite_id: str) -> None:
        with self.session_factory.begin() as session:
            updated_id = session.scalar(
                update(InviteCode)
                .where(InviteCode.id == invite_id, InviteCode.is_active.is_(True))
                .values(is_active=False, updated_at=datetime.now(UTC))
                .returning(InviteCode.id)
            )
            if updated_id is None:
                raise DomainError("INVITE_NOT_FOUND", "邀请码不存在或已停用", 404)

    def redeem(
        self,
        code: str,
        *,
        now: datetime | None = None,
        client_ip: str | None = None,
        trace_id: str | None = None,
    ) -> RedeemedSession:
        redeemed_at = now or datetime.now(UTC)
        expires_at = redeemed_at + timedelta(days=self.settings.session_days)
        token = generate_session_token()
        audit_id = self._start_redeem_audit(client_ip, redeemed_at, trace_id)
        try:
            with self.session_factory.begin() as session:
                row = session.execute(
                    update(InviteCode)
                    .where(
                        InviteCode.code_hash == hash_invite_code(code, self.settings.secret_key),
                        InviteCode.is_active.is_(True),
                        InviteCode.redemption_count < InviteCode.max_redemptions,
                        or_(
                            InviteCode.expires_at.is_(None),
                            InviteCode.expires_at > redeemed_at,
                        ),
                    )
                    .values(redemption_count=InviteCode.redemption_count + 1)
                    .returning(
                        InviteCode.id,
                        InviteCode.max_redemptions,
                        InviteCode.redemption_count,
                    )
                ).one_or_none()
                if row is None:
                    raise DomainError("INVITE_INVALID", "邀请码无效或已达到使用上限", 403)
                access_session = AccessSession(
                    invite_code_id=row.id,
                    token_hash=hash_session_token(token),
                    expires_at=expires_at,
                    last_seen_at=redeemed_at,
                )
                session.add(access_session)
                session.flush()
                access_session_id = access_session.id
        except DomainError:
            self._finish_redeem_audit(
                audit_id,
                result="failed",
                reason=self._invite_failure_reason(code, redeemed_at),
            )
            raise
        self._finish_redeem_audit(audit_id, result="succeeded", resource_id=row.id)
        return RedeemedSession(
            token=token,
            session_id=access_session_id,
            expires_at=expires_at,
            remaining_redemptions=row.max_redemptions - row.redemption_count,
        )

    def _start_redeem_audit(
        self,
        client_ip: str | None,
        attempted_at: datetime,
        trace_id: str | None,
    ) -> str | None:
        if client_ip is None:
            return None
        fingerprint = fingerprint_value("client-ip", client_ip, self.settings.secret_key)
        window_start = attempted_at - timedelta(
            seconds=self.settings.invite_rate_limit_window_seconds
        )
        with self.session_factory.begin() as session:
            is_limited = not self._consume_rate_limit(
                session,
                fingerprint=fingerprint,
                attempted_at=attempted_at,
                window_start=window_start,
            )
            event = AuditEvent(
                session_fingerprint=fingerprint,
                action="invite_redeem",
                resource_type="invite_code",
                result="rate_limited" if is_limited else "pending",
                trace_id=trace_id,
                details={"reason": "rate_limited"} if is_limited else {},
            )
            session.add(event)
            session.flush()
            event_id = event.id
        if is_limited:
            raise DomainError("RATE_LIMITED", "尝试次数过多，请稍后再试", 429)
        return event_id

    def _consume_rate_limit(
        self,
        session: Session,
        *,
        fingerprint: str,
        attempted_at: datetime,
        window_start: datetime,
    ) -> bool:
        table = InviteRateLimitBucket.__table__
        dialect_name = session.get_bind().dialect.name
        if dialect_name == "postgresql":
            statement = postgresql_insert(table)
        elif dialect_name == "sqlite":
            statement = sqlite_insert(table)
        else:
            return self._consume_rate_limit_with_lock(
                session,
                fingerprint=fingerprint,
                attempted_at=attempted_at,
                window_start=window_start,
            )
        is_expired = table.c.window_started_at < window_start
        statement = statement.values(
            client_fingerprint=fingerprint,
            window_started_at=attempted_at,
            attempt_count=1,
            updated_at=attempted_at,
        ).on_conflict_do_update(
            index_elements=[table.c.client_fingerprint],
            set_={
                "window_started_at": case(
                    (is_expired, attempted_at),
                    else_=table.c.window_started_at,
                ),
                "attempt_count": case(
                    (is_expired, 1),
                    else_=table.c.attempt_count + 1,
                ),
                "updated_at": attempted_at,
            },
            where=or_(
                is_expired,
                table.c.attempt_count < self.settings.invite_rate_limit_attempts,
            ),
        )
        result = session.execute(statement)
        return result.rowcount == 1

    def _consume_rate_limit_with_lock(
        self,
        session: Session,
        *,
        fingerprint: str,
        attempted_at: datetime,
        window_start: datetime,
    ) -> bool:
        bucket = session.scalar(
            select(InviteRateLimitBucket)
            .where(InviteRateLimitBucket.client_fingerprint == fingerprint)
            .with_for_update()
        )
        if bucket is None:
            session.add(
                InviteRateLimitBucket(
                    client_fingerprint=fingerprint,
                    window_started_at=attempted_at,
                    attempt_count=1,
                    updated_at=attempted_at,
                )
            )
            return True
        if bucket.window_started_at < window_start:
            bucket.window_started_at = attempted_at
            bucket.attempt_count = 1
            bucket.updated_at = attempted_at
            return True
        if bucket.attempt_count >= self.settings.invite_rate_limit_attempts:
            return False
        bucket.attempt_count += 1
        bucket.updated_at = attempted_at
        return True

    def _invite_failure_reason(self, code: str, attempted_at: datetime) -> str:
        code_hash = hash_invite_code(code, self.settings.secret_key)
        with self.session_factory() as session:
            invite = session.scalar(select(InviteCode).where(InviteCode.code_hash == code_hash))
            if invite is None:
                return "not_found"
            if not invite.is_active:
                return "inactive"
            if invite.expires_at is not None:
                expires_at = invite.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=UTC)
                if expires_at <= attempted_at:
                    return "expired"
            if invite.redemption_count >= invite.max_redemptions:
                return "exhausted"
            return "invalid"

    def _finish_redeem_audit(
        self,
        audit_id: str | None,
        *,
        result: str,
        reason: str | None = None,
        resource_id: str | None = None,
    ) -> None:
        if audit_id is None:
            return
        with self.session_factory.begin() as session:
            event = session.get(AuditEvent, audit_id)
            if event is not None:
                event.result = result
                event.resource_id = resource_id
                event.details = {"reason": reason} if reason is not None else {}

    def require_session(self, token: str | None, *, now: datetime | None = None) -> AccessSession:
        if not token:
            raise DomainError("ACCESS_REQUIRED", "请先输入有效邀请码", 401)
        checked_at = now or datetime.now(UTC)
        with self.session_factory.begin() as session:
            access_session = session.scalar(
                select(AccessSession).where(
                    AccessSession.token_hash == hash_session_token(token),
                    AccessSession.revoked_at.is_(None),
                    AccessSession.expires_at > checked_at,
                )
            )
            if access_session is None:
                raise DomainError("ACCESS_REQUIRED", "访问会话已失效，请重新输入邀请码", 401)
            access_session.last_seen_at = checked_at
            session.flush()
            session.expunge(access_session)
            return access_session

    def revoke(self, token: str | None, *, now: datetime | None = None) -> None:
        if not token:
            return
        revoked_at = now or datetime.now(UTC)
        with self.session_factory.begin() as session:
            session.execute(
                update(AccessSession)
                .where(
                    AccessSession.token_hash == hash_session_token(token),
                    AccessSession.revoked_at.is_(None),
                )
                .values(revoked_at=revoked_at)
            )
