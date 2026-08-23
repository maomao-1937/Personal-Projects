from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import InviteCodeInvalid, InviteQuotaExhausted
from app.core.security import Security
from app.models import InviteCode


@dataclass(frozen=True, slots=True)
class InviteAccess:
    invite_id: str
    remaining_uses: int


class InviteService:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        security: Security,
        *,
        usage_limit: int,
    ) -> None:
        self._session_factory = session_factory
        self._security = security
        self._usage_limit = usage_limit

    def sync_configured_codes(self, raw_codes: tuple[str, ...]) -> None:
        configured = {
            self._security.digest_invite(raw_code): index
            for index, raw_code in enumerate(raw_codes, start=1)
            if raw_code.strip()
        }
        with self._session_factory.begin() as session:
            existing = {
                invite.code_digest: invite for invite in session.scalars(select(InviteCode)).all()
            }
            for digest, existing_invite in existing.items():
                existing_invite.is_active = digest in configured

            for digest, index in configured.items():
                configured_invite = existing.get(digest)
                if configured_invite is not None:
                    configured_invite.is_active = True
                    continue
                session.add(
                    InviteCode(
                        code_digest=digest,
                        label=f"pilot-{index:02d}",
                        usage_limit=self._usage_limit,
                    )
                )

    def redeem(self, raw_code: str) -> InviteAccess:
        digest = self._security.digest_invite(raw_code)
        with self._session_factory() as session:
            invite = session.scalar(select(InviteCode).where(InviteCode.code_digest == digest))
            if invite is None or not invite.is_active:
                raise InviteCodeInvalid()

            remaining_uses = invite.usage_limit - invite.used_count - invite.reserved_count
            if remaining_uses <= 0:
                raise InviteQuotaExhausted()
            return InviteAccess(
                invite_id=invite.id,
                remaining_uses=remaining_uses,
            )

    def get_access(self, invite_id: str) -> InviteAccess:
        with self._session_factory() as session:
            invite = session.get(InviteCode, invite_id)
            if invite is None or not invite.is_active:
                raise InviteCodeInvalid()
            return InviteAccess(
                invite_id=invite.id,
                remaining_uses=max(
                    invite.usage_limit - invite.used_count - invite.reserved_count,
                    0,
                ),
            )
