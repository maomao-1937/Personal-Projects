from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.access.models import InviteCode
from app.access.service import AccessService, CreatedInvite
from app.core.config import Settings
from app.core.security import hash_invite_code, normalize_invite_code


def ensure_bootstrap_invite(
    *,
    settings: Settings,
    session_factory: sessionmaker[Session],
    code: str,
    label: str,
    max_redemptions: int = 50,
) -> CreatedInvite:
    normalized_code = normalize_invite_code(code)
    if not normalized_code:
        raise ValueError("BOOTSTRAP_INVITE_CODE must not be empty")

    code_hash = hash_invite_code(normalized_code, settings.secret_key)
    with session_factory() as session:
        existing = session.scalar(select(InviteCode).where(InviteCode.code_hash == code_hash))
    if existing is not None:
        return CreatedInvite(id=existing.id, code=normalized_code)

    return AccessService(settings, session_factory).create_invite(
        label=label,
        max_redemptions=max_redemptions,
        code=normalized_code,
    )
