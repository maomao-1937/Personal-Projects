from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import event, select

from app.access.models import InviteCode, InviteRateLimitBucket
from app.access.service import AccessService
from app.core.errors import DomainError


def test_sqlite_rate_limit_does_not_require_returning(settings, session_factory, invite_code):
    statements: list[str] = []
    engine = session_factory.kw["bind"]

    def capture_statement(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", capture_statement)
    try:
        AccessService(settings, session_factory).redeem(
            invite_code,
            client_ip="203.0.113.43",
        )
    finally:
        event.remove(engine, "before_cursor_execute", capture_statement)

    rate_limit_statements = [
        statement
        for statement in statements
        if "invite_rate_limit_buckets" in statement and statement.lstrip().startswith("INSERT")
    ]
    assert rate_limit_statements
    assert all("RETURNING" not in statement.upper() for statement in rate_limit_statements)


def test_concurrent_redemption_never_exceeds_fifty(settings, session_factory, invite_code):
    service = AccessService(settings, session_factory)

    def redeem_once() -> bool:
        try:
            service.redeem(invite_code)
        except DomainError as error:
            assert error.code == "INVITE_INVALID"
            return False
        return True

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(lambda _: redeem_once(), range(60)))

    assert results.count(True) == 50
    assert results.count(False) == 10
    with session_factory() as session:
        stored = session.scalar(select(InviteCode))
        assert stored is not None
        assert stored.redemption_count == 50


def test_concurrent_rate_limit_uses_atomic_fingerprint_bucket(
    settings, session_factory, invite_code
):
    settings.invite_rate_limit_attempts = 10
    service = AccessService(settings, session_factory)

    def redeem_once() -> str:
        try:
            service.redeem(invite_code, client_ip="203.0.113.42")
        except DomainError as error:
            return error.code
        return "succeeded"

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(lambda _: redeem_once(), range(20)))

    assert results.count("succeeded") == 10
    assert results.count("RATE_LIMITED") == 10
    with session_factory() as session:
        bucket = session.scalar(select(InviteRateLimitBucket))
    assert bucket is not None
    assert bucket.attempt_count == 10
