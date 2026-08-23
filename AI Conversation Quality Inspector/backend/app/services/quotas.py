from dataclasses import dataclass
from datetime import timedelta
from typing import Any, cast

from sqlalchemy import select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import utc_now
from app.core.errors import AppError, InviteCodeInvalid, InviteQuotaExhausted
from app.models import (
    AnalysisAttempt,
    AnalysisStatus,
    InviteCode,
    QAType,
    QuotaStatus,
    RiskLevel,
)


@dataclass(frozen=True, slots=True)
class CompletionMetadata:
    analysis_status: AnalysisStatus
    latency_ms: int
    model_version: str
    scored_dimension_count: int
    risk_level: RiskLevel


@dataclass(frozen=True, slots=True)
class QuotaReservation:
    id: str
    quota_status: QuotaStatus
    is_new: bool


class QuotaService:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        *,
        rubric_version: str,
        prompt_version: str,
        reservation_ttl_seconds: int,
    ) -> None:
        self._session_factory = session_factory
        self._rubric_version = rubric_version
        self._prompt_version = prompt_version
        self._reservation_ttl_seconds = reservation_ttl_seconds

    def reserve(
        self,
        invite_id: str,
        idempotency_key: str,
        qa_type: QAType | str,
        char_count: int,
        turn_count: int,
    ) -> QuotaReservation:
        try:
            with self._session_factory.begin() as session:
                existing = session.scalar(
                    select(AnalysisAttempt).where(
                        AnalysisAttempt.invite_code_id == invite_id,
                        AnalysisAttempt.idempotency_key == idempotency_key,
                    )
                )
                if existing is not None:
                    return QuotaReservation(
                        id=existing.id,
                        quota_status=existing.quota_status,
                        is_new=False,
                    )

                statement = (
                    update(InviteCode)
                    .where(
                        InviteCode.id == invite_id,
                        InviteCode.is_active.is_(True),
                        InviteCode.used_count + InviteCode.reserved_count < InviteCode.usage_limit,
                    )
                    .values(
                        reserved_count=InviteCode.reserved_count + 1,
                        updated_at=utc_now(),
                    )
                )
                result = cast(CursorResult[Any], session.execute(statement))
                if result.rowcount != 1:
                    invite = session.get(InviteCode, invite_id)
                    if invite is None or not invite.is_active:
                        raise InviteCodeInvalid()
                    raise InviteQuotaExhausted()

                attempt = AnalysisAttempt(
                    invite_code_id=invite_id,
                    idempotency_key=idempotency_key,
                    qa_type=QAType(qa_type),
                    quota_status=QuotaStatus.RESERVED,
                    char_count=char_count,
                    turn_count=turn_count,
                    rubric_version=self._rubric_version,
                    prompt_version=self._prompt_version,
                )
                session.add(attempt)
                session.flush()
                return QuotaReservation(
                    id=attempt.id,
                    quota_status=attempt.quota_status,
                    is_new=True,
                )
        except IntegrityError:
            with self._session_factory() as session:
                existing = session.scalar(
                    select(AnalysisAttempt).where(
                        AnalysisAttempt.invite_code_id == invite_id,
                        AnalysisAttempt.idempotency_key == idempotency_key,
                    )
                )
                if existing is None:
                    raise
                return QuotaReservation(
                    id=existing.id,
                    quota_status=existing.quota_status,
                    is_new=False,
                )

    def consume(self, attempt_id: str, metadata: CompletionMetadata) -> None:
        completed_at = utc_now()
        with self._session_factory.begin() as session:
            transition = cast(
                CursorResult[Any],
                session.execute(
                    update(AnalysisAttempt)
                    .where(
                        AnalysisAttempt.id == attempt_id,
                        AnalysisAttempt.quota_status == QuotaStatus.RESERVED,
                    )
                    .values(
                        quota_status=QuotaStatus.CONSUMED,
                        analysis_status=metadata.analysis_status,
                        latency_ms=metadata.latency_ms,
                        model_version=metadata.model_version,
                        scored_dimension_count=metadata.scored_dimension_count,
                        risk_level=metadata.risk_level,
                        error_type=None,
                        completed_at=completed_at,
                    )
                ),
            )
            if transition.rowcount != 1:
                attempt = session.get(AnalysisAttempt, attempt_id)
                if attempt is not None and attempt.quota_status == QuotaStatus.CONSUMED:
                    return
                raise self._invalid_transition(attempt_id)

            invite_id = session.scalar(
                select(AnalysisAttempt.invite_code_id).where(AnalysisAttempt.id == attempt_id)
            )
            counter_update = cast(
                CursorResult[Any],
                session.execute(
                    update(InviteCode)
                    .where(InviteCode.id == invite_id, InviteCode.reserved_count > 0)
                    .values(
                        reserved_count=InviteCode.reserved_count - 1,
                        used_count=InviteCode.used_count + 1,
                        updated_at=completed_at,
                    )
                ),
            )
            if counter_update.rowcount != 1:
                raise self._invalid_transition(attempt_id)

    def release(self, attempt_id: str, error_type: str) -> None:
        completed_at = utc_now()
        with self._session_factory.begin() as session:
            invite_id = session.scalar(
                select(AnalysisAttempt.invite_code_id).where(AnalysisAttempt.id == attempt_id)
            )
            transition = cast(
                CursorResult[Any],
                session.execute(
                    update(AnalysisAttempt)
                    .where(
                        AnalysisAttempt.id == attempt_id,
                        AnalysisAttempt.quota_status == QuotaStatus.RESERVED,
                    )
                    .values(
                        quota_status=QuotaStatus.RELEASED,
                        error_type=error_type,
                        completed_at=completed_at,
                    )
                ),
            )
            if transition.rowcount != 1:
                attempt = session.get(AnalysisAttempt, attempt_id)
                if attempt is not None and attempt.quota_status == QuotaStatus.RELEASED:
                    return
                raise self._invalid_transition(attempt_id)

            counter_update = cast(
                CursorResult[Any],
                session.execute(
                    update(InviteCode)
                    .where(InviteCode.id == invite_id, InviteCode.reserved_count > 0)
                    .values(
                        reserved_count=InviteCode.reserved_count - 1,
                        updated_at=completed_at,
                    )
                ),
            )
            if counter_update.rowcount != 1:
                raise self._invalid_transition(attempt_id)

    def reclaim_expired(self) -> int:
        cutoff = utc_now() - timedelta(seconds=self._reservation_ttl_seconds)
        with self._session_factory() as session:
            attempt_ids = tuple(
                session.scalars(
                    select(AnalysisAttempt.id).where(
                        AnalysisAttempt.quota_status == QuotaStatus.RESERVED,
                        AnalysisAttempt.created_at < cutoff,
                    )
                )
            )
        for attempt_id in attempt_ids:
            self.release(attempt_id, "RESERVATION_EXPIRED")
        return len(attempt_ids)

    def remaining(self, invite_id: str) -> int:
        with self._session_factory() as session:
            invite = session.get(InviteCode, invite_id)
            if invite is None or not invite.is_active:
                raise InviteCodeInvalid()
            return max(
                invite.usage_limit - invite.used_count - invite.reserved_count,
                0,
            )

    @staticmethod
    def _invalid_transition(attempt_id: str) -> AppError:
        return AppError(
            code="QUOTA_STATE_INVALID",
            message=f"分析请求 {attempt_id} 的额度状态无法转换。",
            status_code=409,
        )
