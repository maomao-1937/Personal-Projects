from importlib.util import find_spec

import pytest


def _security_types():
    module_spec = find_spec("app.core.security")
    assert module_spec is not None, "app.core.security must exist"
    from app.core.errors import AccessTokenExpired, AccessTokenInvalid
    from app.core.security import Security

    return Security, AccessTokenExpired, AccessTokenInvalid


@pytest.fixture
def security():
    security_class, _, _ = _security_types()
    return security_class(
        session_secret="s" * 32,
        invite_code_pepper="p" * 32,
        access_ttl_seconds=43_200,
    )


def test_invite_digest_never_contains_plain_code(security) -> None:
    code = "pilot_" + "A" * 32

    digest = security.digest_invite(code)

    assert code not in digest
    assert len(digest) == 64


def test_access_token_round_trip_preserves_only_access_context(security) -> None:
    token, csrf = security.issue_access("invite-1")

    context = security.read_access(token)

    assert context.invite_id == "invite-1"
    assert context.csrf_token == csrf


def test_access_token_rejects_tampering(security) -> None:
    _, _, access_token_invalid = _security_types()
    token, _ = security.issue_access("invite-1")

    with pytest.raises(access_token_invalid):
        security.read_access(token + "x")


def test_access_token_rejects_expiry(security) -> None:
    _, access_token_expired, _ = _security_types()
    token, _ = security.issue_access("invite-1")

    with pytest.raises(access_token_expired):
        security.read_access(token, max_age_seconds=-1)


def test_csrf_uses_exact_constant_time_value(security) -> None:
    _, csrf = security.issue_access("invite-1")

    assert security.verify_csrf(csrf, csrf) is True
    assert security.verify_csrf(csrf, csrf + "x") is False
