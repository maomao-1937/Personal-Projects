from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.core.database import Base, create_database_engine, create_session_factory, utc_now
from app.core.errors import InviteQuotaExhausted
from app.models import AnalysisAttempt, AnalysisStatus, InviteCode, QuotaStatus, RiskLevel
from app.services.quotas import CompletionMetadata, QuotaService


@pytest.fixture
def quota_context(tmp_path: Path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'quota.db'}")
    Base.metadata.create_all(engine)
    factory = create_session_factory(engine)
    invite_id = str(uuid4())
    with factory.begin() as session:
        session.add(
            InviteCode(
                id=invite_id,
                code_digest="d" * 64,
                label="quota-test",
                usage_limit=50,
            )
        )
    service = QuotaService(
        factory,
        rubric_version="qa-rubric-v1",
        prompt_version="qa-analysis-v1",
        reservation_ttl_seconds=180,
    )
    yield service, factory, invite_id
    engine.dispose()


@pytest.fixture
def completed_metadata() -> CompletionMetadata:
    return CompletionMetadata(
        analysis_status=AnalysisStatus.SCORED,
        latency_ms=1250,
        model_version="fake-model-v1",
        scored_dimension_count=6,
        risk_level=RiskLevel.NONE,
    )


def test_only_fifty_successes_can_be_consumed(
    quota_context, completed_metadata: CompletionMetadata
) -> None:
    service, factory, invite_id = quota_context

    for _ in range(50):
        attempt = service.reserve(invite_id, str(uuid4()), "sales", 120, 4)
        service.consume(attempt.id, completed_metadata)

    with pytest.raises(InviteQuotaExhausted):
        service.reserve(invite_id, str(uuid4()), "sales", 120, 4)

    with factory() as session:
        invite = session.get(InviteCode, invite_id)
        assert invite is not None
        assert invite.used_count == 50
        assert invite.reserved_count == 0


def test_released_attempt_does_not_reduce_quota(quota_context) -> None:
    service, _, invite_id = quota_context
    attempt = service.reserve(invite_id, str(uuid4()), "sales", 120, 4)

    service.release(attempt.id, "MODEL_TIMEOUT")

    assert service.remaining(invite_id) == 50


def test_duplicate_idempotency_key_does_not_reserve_twice(quota_context) -> None:
    service, factory, invite_id = quota_context
    idempotency_key = str(uuid4())

    first = service.reserve(invite_id, idempotency_key, "sales", 120, 4)
    second = service.reserve(invite_id, idempotency_key, "sales", 120, 4)

    assert second.id == first.id
    assert service.remaining(invite_id) == 49
    with factory() as session:
        attempt_count = session.scalar(select(func.count()).select_from(AnalysisAttempt))
        assert attempt_count == 1


def test_expired_reservation_is_reclaimed(quota_context) -> None:
    service, factory, invite_id = quota_context
    attempt = service.reserve(invite_id, str(uuid4()), "sales", 120, 4)
    with factory.begin() as session:
        row = session.get(AnalysisAttempt, attempt.id)
        assert row is not None
        row.created_at = utc_now() - timedelta(seconds=181)

    reclaimed = service.reclaim_expired()

    assert reclaimed == 1
    assert service.remaining(invite_id) == 50
    with factory() as session:
        row = session.get(AnalysisAttempt, attempt.id)
        assert row is not None
        assert row.quota_status == QuotaStatus.RELEASED
        assert row.error_type == "RESERVATION_EXPIRED"


def test_parallel_reservations_never_exceed_limit(
    quota_context, completed_metadata: CompletionMetadata
) -> None:
    service, factory, invite_id = quota_context

    def consume_once(index: int) -> bool:
        try:
            attempt = service.reserve(
                invite_id,
                str(uuid4()),
                "customer_service",
                100 + index,
                2,
            )
        except InviteQuotaExhausted:
            return False
        service.consume(attempt.id, replace(completed_metadata, latency_ms=1000 + index))
        return True

    with ThreadPoolExecutor(max_workers=12) as executor:
        results = list(executor.map(consume_once, range(60)))

    assert sum(results) == 50
    with factory() as session:
        invite = session.get(InviteCode, invite_id)
        assert invite is not None
        assert invite.used_count == 50
        assert invite.reserved_count == 0
