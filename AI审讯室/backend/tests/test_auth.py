from __future__ import annotations

from hashlib import sha256

import pytest

from app.services.auth import (
    AccessAuthService,
    AuthRateLimitedError,
    AuthRequiredError,
    InvalidAccessTokenError,
)


def test_correct_access_token_issues_verifiable_cookie() -> None:
    service = AccessAuthService(
        access_token_hash=sha256(b"ONE-TOKEN").hexdigest(),
        signing_secret="signing-secret",
        subject="pilot",
        clock=lambda: 1_700_000_000,
    )

    cookie = service.login("ONE-TOKEN", "127.0.0.1")

    assert service.verify_cookie(cookie).subject == "pilot"


def test_plaintext_access_token_is_not_retained() -> None:
    service = AccessAuthService(
        access_token_hash=sha256(b"ONE-TOKEN").hexdigest(),
        signing_secret="signing-secret",
    )

    assert "ONE-TOKEN" not in repr(service)


@pytest.mark.parametrize("cookie_transform", [lambda value: value + "x", lambda value: None])
def test_tampered_or_missing_cookie_is_rejected(cookie_transform) -> None:
    service = AccessAuthService(
        access_token_hash=sha256(b"ONE-TOKEN").hexdigest(),
        signing_secret="signing-secret",
        clock=lambda: 1_700_000_000,
    )
    cookie = service.login("ONE-TOKEN", "127.0.0.1")

    with pytest.raises(AuthRequiredError):
        service.verify_cookie(cookie_transform(cookie))


def test_expired_cookie_is_rejected() -> None:
    now = [1_700_000_000]
    service = AccessAuthService(
        access_token_hash=sha256(b"ONE-TOKEN").hexdigest(),
        signing_secret="signing-secret",
        ttl_seconds=60,
        clock=lambda: now[0],
    )
    cookie = service.login("ONE-TOKEN", "127.0.0.1")
    now[0] += 61

    with pytest.raises(AuthRequiredError):
        service.verify_cookie(cookie)


def test_repeated_bad_tokens_are_rate_limited_per_source() -> None:
    service = AccessAuthService(
        access_token_hash=sha256(b"ONE-TOKEN").hexdigest(),
        signing_secret="signing-secret",
        max_failures=3,
        clock=lambda: 1_700_000_000,
    )
    for _ in range(3):
        with pytest.raises(InvalidAccessTokenError):
            service.login("WRONG", "127.0.0.1")

    with pytest.raises(AuthRateLimitedError):
        service.login("WRONG", "127.0.0.1")

    assert service.verify_cookie(service.login("ONE-TOKEN", "127.0.0.2"))


def test_successful_login_clears_prior_failures() -> None:
    service = AccessAuthService(
        access_token_hash=sha256(b"ONE-TOKEN").hexdigest(),
        signing_secret="signing-secret",
        max_failures=2,
        clock=lambda: 1_700_000_000,
    )
    with pytest.raises(InvalidAccessTokenError):
        service.login("WRONG", "127.0.0.1")

    service.login("ONE-TOKEN", "127.0.0.1")

    with pytest.raises(InvalidAccessTokenError):
        service.login("WRONG", "127.0.0.1")
    with pytest.raises(InvalidAccessTokenError):
        service.login("WRONG", "127.0.0.1")


def test_missing_configuration_is_reported() -> None:
    service = AccessAuthService(access_token_hash="", signing_secret="")

    assert service.configured is False
    with pytest.raises(AuthRequiredError):
        service.login("ANYTHING", "127.0.0.1")
