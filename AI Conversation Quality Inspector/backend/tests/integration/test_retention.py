from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import func, select

from app.core.database import Base, create_database_engine, create_session_factory, utc_now
from app.models import (
    AnalysisAttempt,
    AnalysisStatus,
    Feedback,
    InviteCode,
    QAType,
    QuotaStatus,
    RiskLevel,
)
from app.services.retention import RetentionService


def test_cleanup_removes_old_metadata_without_restoring_quota(tmp_path: Path) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'retention.db'}")
    Base.metadata.create_all(engine)
    factory = create_session_factory(engine)
    invite_id = str(uuid4())
    old_attempt_id = str(uuid4())
    recent_attempt_id = str(uuid4())
    old_time = utc_now() - timedelta(days=91)
    with factory.begin() as session:
        session.add(
            InviteCode(
                id=invite_id,
                code_digest="r" * 64,
                label="retention-test",
                usage_limit=50,
                used_count=2,
            )
        )
        session.flush()
        for attempt_id, created_at in (
            (old_attempt_id, old_time),
            (recent_attempt_id, utc_now()),
        ):
            session.add(
                AnalysisAttempt(
                    id=attempt_id,
                    invite_code_id=invite_id,
                    idempotency_key=str(uuid4()),
                    qa_type=QAType.SALES,
                    quota_status=QuotaStatus.CONSUMED,
                    analysis_status=AnalysisStatus.SCORED,
                    char_count=100,
                    turn_count=2,
                    latency_ms=100,
                    model_version="fake-model-v1",
                    rubric_version="qa-rubric-v1",
                    prompt_version="qa-analysis-v1",
                    scored_dimension_count=6,
                    risk_level=RiskLevel.NONE,
                    created_at=created_at,
                    completed_at=created_at,
                )
            )
        session.add(
            Feedback(
                analysis_id=old_attempt_id,
                invite_code_id=invite_id,
                helpful=True,
                created_at=old_time,
                updated_at=old_time,
            )
        )

    result = RetentionService(factory, retention_days=90).cleanup()

    assert result.deleted_attempts == 1
    assert result.deleted_feedback == 1
    with factory() as session:
        invite = session.get(InviteCode, invite_id)
        assert invite is not None
        assert invite.used_count == 2
        assert session.scalar(select(func.count()).select_from(AnalysisAttempt)) == 1
        assert session.scalar(select(func.count()).select_from(Feedback)) == 0
    engine.dispose()
