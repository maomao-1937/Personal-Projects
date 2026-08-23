from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.core.config import Settings
from app.core.database import Base, create_database_engine, create_session_factory
from app.core.errors import (
    BackupUnavailable,
    IdempotencyConflict,
    ModelUnavailable,
    TranscriptInvalid,
)
from app.models import AnalysisAttempt, InviteCode, QuotaStatus
from app.schemas.analysis import AnalysisRequest
from app.services.analysis import AnalysisService
from app.services.quotas import QuotaService
from tests.support import VALID_TRANSCRIPT, StaticModel


class UnhealthyBeforeConsume:
    def is_healthy(self, *, max_age_seconds: int) -> bool:
        return False


def build_context(
    tmp_path: Path,
    *,
    fail_model: bool = False,
    backup_health=None,
):
    settings = Settings(
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'analysis.db'}",
        llm_api_key="test-key",
        llm_model="fake-model-v1",
    )
    engine = create_database_engine(settings.database_url)
    Base.metadata.create_all(engine)
    factory = create_session_factory(engine)
    invite_id = str(uuid4())
    with factory.begin() as session:
        session.add(
            InviteCode(
                id=invite_id,
                code_digest="a" * 64,
                label="analysis-test",
                usage_limit=50,
            )
        )
    quota_service = QuotaService(
        factory,
        rubric_version=settings.rubric_version,
        prompt_version=settings.prompt_version,
        reservation_ttl_seconds=settings.reservation_ttl_seconds,
    )
    model = StaticModel(fail=fail_model)
    service = AnalysisService(settings, quota_service, model, backup_health=backup_health)
    return service, quota_service, model, factory, invite_id, engine


def valid_request() -> AnalysisRequest:
    return AnalysisRequest(qa_type="sales", transcript=VALID_TRANSCRIPT)


def test_success_consumes_one_and_returns_report(tmp_path: Path) -> None:
    service, _, model, factory, invite_id, engine = build_context(tmp_path)

    outcome = service.analyze(invite_id, str(uuid4()), valid_request())

    assert outcome.remaining_uses == 49
    assert outcome.analysis_status == "scored"
    assert outcome.total_score == 70
    assert outcome.model_version == "fake-model-v1"
    assert model.call_count == 1
    with factory() as session:
        attempt = session.get(AnalysisAttempt, outcome.analysis_id)
        assert attempt is not None
        assert attempt.quota_status == QuotaStatus.CONSUMED
    engine.dispose()


def test_model_failure_releases_reserved_quota(tmp_path: Path) -> None:
    service, quota_service, _, factory, invite_id, engine = build_context(tmp_path, fail_model=True)

    with pytest.raises(ModelUnavailable):
        service.analyze(invite_id, str(uuid4()), valid_request())

    assert quota_service.remaining(invite_id) == 50
    with factory() as session:
        attempt = session.scalar(select(AnalysisAttempt))
        assert attempt is not None
        assert attempt.quota_status == QuotaStatus.RELEASED
        assert attempt.error_type == "MODEL_UNAVAILABLE"
    engine.dispose()


def test_invalid_input_never_creates_quota_attempt(tmp_path: Path) -> None:
    service, quota_service, model, factory, invite_id, engine = build_context(tmp_path)

    with pytest.raises(TranscriptInvalid):
        service.analyze(
            invite_id,
            str(uuid4()),
            AnalysisRequest(qa_type="sales", transcript="客户：你好"),
        )

    assert quota_service.remaining(invite_id) == 50
    assert model.call_count == 0
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(AnalysisAttempt)) == 0
    engine.dispose()


def test_consumed_idempotency_key_cannot_run_model_twice(tmp_path: Path) -> None:
    service, quota_service, model, _, invite_id, engine = build_context(tmp_path)
    idempotency_key = str(uuid4())
    service.analyze(invite_id, idempotency_key, valid_request())

    with pytest.raises(IdempotencyConflict):
        service.analyze(invite_id, idempotency_key, valid_request())

    assert quota_service.remaining(invite_id) == 49
    assert model.call_count == 1
    engine.dispose()


def test_backup_expiry_during_model_call_releases_reservation(tmp_path: Path) -> None:
    service, quota_service, model, factory, invite_id, engine = build_context(
        tmp_path,
        backup_health=UnhealthyBeforeConsume(),
    )

    with pytest.raises(BackupUnavailable):
        service.analyze(invite_id, str(uuid4()), valid_request())

    assert model.call_count == 1
    assert quota_service.remaining(invite_id) == 50
    with factory() as session:
        attempt = session.scalar(select(AnalysisAttempt))
        assert attempt is not None
        assert attempt.quota_status == QuotaStatus.RELEASED
        assert attempt.error_type == "BACKUP_UNAVAILABLE"
    engine.dispose()
