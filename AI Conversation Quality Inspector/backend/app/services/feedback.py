from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import utc_now
from app.core.errors import AnalysisNotFound
from app.models import AnalysisAttempt, Feedback, FeedbackReason, QuotaStatus
from app.schemas.feedback import FeedbackResponse


class FeedbackService:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def upsert(
        self,
        invite_id: str,
        analysis_id: str,
        *,
        helpful: bool,
        reason_code: FeedbackReason | None,
    ) -> FeedbackResponse:
        now = utc_now()
        with self._session_factory.begin() as session:
            attempt = session.scalar(
                select(AnalysisAttempt).where(
                    AnalysisAttempt.id == analysis_id,
                    AnalysisAttempt.invite_code_id == invite_id,
                    AnalysisAttempt.quota_status == QuotaStatus.CONSUMED,
                )
            )
            if attempt is None:
                raise AnalysisNotFound()

            feedback = session.get(Feedback, analysis_id)
            if feedback is None:
                feedback = Feedback(
                    analysis_id=analysis_id,
                    invite_code_id=invite_id,
                    helpful=helpful,
                    reason_code=reason_code,
                    created_at=now,
                    updated_at=now,
                )
                session.add(feedback)
            else:
                feedback.helpful = helpful
                feedback.reason_code = reason_code
                feedback.updated_at = now

        return FeedbackResponse(helpful=helpful, reason_code=reason_code)
