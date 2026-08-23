import pytest
from sqlalchemy import func, select

from app.access.bootstrap import ensure_bootstrap_invite
from app.access.models import InviteCode


def test_bootstrap_invite_is_idempotent(settings, session_factory):
    code = "MM-DEPLOYMENT-ACCESS-CODE"

    first = ensure_bootstrap_invite(
        settings=settings,
        session_factory=session_factory,
        code=code,
        label="vefaas-demo",
    )
    second = ensure_bootstrap_invite(
        settings=settings,
        session_factory=session_factory,
        code=code,
        label="vefaas-demo",
    )

    with session_factory() as session:
        invite_count = session.scalar(select(func.count()).select_from(InviteCode))

    assert first.id == second.id
    assert first.code == code
    assert second.code == code
    assert invite_count == 1


def test_bootstrap_invite_rejects_an_empty_code(settings, session_factory):
    with pytest.raises(ValueError, match="BOOTSTRAP_INVITE_CODE"):
        ensure_bootstrap_invite(
            settings=settings,
            session_factory=session_factory,
            code="  ",
            label="vefaas-demo",
        )
