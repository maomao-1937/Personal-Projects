from importlib.util import find_spec

import pytest
from sqlalchemy import select

from app.core.database import Base, create_database_engine, create_session_factory
from app.models import InviteCode


def _invite_types():
    module_spec = find_spec("app.services.invites")
    assert module_spec is not None, "app.services.invites must exist"
    from app.core.errors import InviteCodeInvalid, InviteQuotaExhausted
    from app.core.security import Security
    from app.services.invites import InviteService

    return InviteService, Security, InviteCodeInvalid, InviteQuotaExhausted


@pytest.fixture
def invite_service():
    invite_service_class, security_class, _, _ = _invite_types()
    engine = create_database_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = create_session_factory(engine)
    security = security_class("s" * 32, "p" * 32, 43_200)
    return invite_service_class(factory, security, usage_limit=50), factory


def test_sync_stores_digest_without_plain_code(invite_service) -> None:
    service, factory = invite_service
    raw_code = "pilot_" + "A" * 32

    service.sync_configured_codes((raw_code,))

    with factory() as session:
        row = session.scalar(select(InviteCode))
        assert row is not None
        assert row.code_digest != raw_code
        assert len(row.code_digest) == 64


def test_sync_does_not_reset_existing_usage(invite_service) -> None:
    service, factory = invite_service
    raw_code = "pilot_" + "B" * 32
    service.sync_configured_codes((raw_code,))
    with factory.begin() as session:
        row = session.scalar(select(InviteCode))
        assert row is not None
        row.used_count = 7

    service.sync_configured_codes((raw_code,))

    with factory() as session:
        row = session.scalar(select(InviteCode))
        assert row is not None
        assert row.used_count == 7


def test_redeem_returns_remaining_quota(invite_service) -> None:
    service, _ = invite_service
    raw_code = "pilot_" + "C" * 32
    service.sync_configured_codes((raw_code,))

    access = service.redeem(raw_code)

    assert access.remaining_uses == 50
    assert access.invite_id


def test_redeem_rejects_wrong_and_exhausted_codes(invite_service) -> None:
    service, factory = invite_service
    _, _, invite_code_invalid, invite_quota_exhausted = _invite_types()
    raw_code = "pilot_" + "D" * 32
    service.sync_configured_codes((raw_code,))

    with pytest.raises(invite_code_invalid):
        service.redeem("wrong_" + "x" * 32)

    with factory.begin() as session:
        row = session.scalar(select(InviteCode))
        assert row is not None
        row.used_count = row.usage_limit

    with pytest.raises(invite_quota_exhausted):
        service.redeem(raw_code)
