from dataclasses import dataclass
from datetime import timedelta
from typing import Any, cast

from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import utc_now
from app.models import AnalysisAttempt, Feedback, QuotaStatus


@dataclass(frozen=True, slots=True)
class CleanupResult:
    deleted_attempts: int
    deleted_feedback: int


class RetentionService:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        *,
        retention_days: int,
    ) -> None:
        self._session_factory = session_factory
        self._retention_days = retention_days

    def cleanup(self) -> CleanupResult:
        cutoff = utc_now() - timedelta(days=self._retention_days)
        with self._session_factory.begin() as session:
            old_attempt_ids = tuple(
                session.scalars(
                    select(AnalysisAttempt.id).where(
                        AnalysisAttempt.created_at < cutoff,
                        AnalysisAttempt.quota_status != QuotaStatus.RESERVED,
                    )
                )
            )
            if not old_attempt_ids:
                return CleanupResult(deleted_attempts=0, deleted_feedback=0)
            feedback_result = cast(
                CursorResult[Any],
                session.execute(delete(Feedback).where(Feedback.analysis_id.in_(old_attempt_ids))),
            )
            attempt_result = cast(
                CursorResult[Any],
                session.execute(
                    delete(AnalysisAttempt).where(AnalysisAttempt.id.in_(old_attempt_ids))
                ),
            )
            return CleanupResult(
                deleted_attempts=attempt_result.rowcount,
                deleted_feedback=feedback_result.rowcount,
            )
