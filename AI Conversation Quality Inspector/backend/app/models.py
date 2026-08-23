from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utc_now


def new_uuid() -> str:
    return str(uuid4())


class QAType(StrEnum):
    SALES = "sales"
    CUSTOMER_SERVICE = "customer_service"


class QuotaStatus(StrEnum):
    RESERVED = "reserved"
    CONSUMED = "consumed"
    RELEASED = "released"


class AnalysisStatus(StrEnum):
    SCORED = "scored"
    PARTIAL = "partial"
    UNABLE_TO_SCORE = "unable_to_score"


class RiskLevel(StrEnum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    UNKNOWN = "unknown"


class FeedbackReason(StrEnum):
    EVIDENCE_WRONG = "evidence_wrong"
    SCORE_UNFAIR = "score_unfair"
    REPLY_UNUSABLE = "reply_unusable"
    CONTEXT_MISSING = "context_missing"
    OTHER = "other"


class InviteCode(Base):
    __tablename__ = "invite_codes"
    __table_args__ = (
        CheckConstraint("usage_limit > 0", name="ck_invite_limit_positive"),
        CheckConstraint("used_count >= 0", name="ck_invite_used_nonnegative"),
        CheckConstraint("reserved_count >= 0", name="ck_invite_reserved_nonnegative"),
        CheckConstraint(
            "used_count + reserved_count <= usage_limit",
            name="ck_invite_counts_within_limit",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    code_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    usage_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class AnalysisAttempt(Base):
    __tablename__ = "analysis_attempts"
    __table_args__ = (
        UniqueConstraint(
            "invite_code_id",
            "idempotency_key",
            name="uq_attempt_invite_idempotency",
        ),
        CheckConstraint("char_count >= 0", name="ck_attempt_char_count_nonnegative"),
        CheckConstraint("turn_count >= 0", name="ck_attempt_turn_count_nonnegative"),
        CheckConstraint(
            "scored_dimension_count IS NULL OR "
            "(scored_dimension_count >= 0 AND scored_dimension_count <= 6)",
            name="ck_attempt_scored_dimension_count",
        ),
        Index("ix_attempt_invite_created", "invite_code_id", "created_at"),
        Index("ix_attempt_quota_created", "quota_status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    invite_code_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invite_codes.id", ondelete="CASCADE"), nullable=False
    )
    idempotency_key: Mapped[str] = mapped_column(String(36), nullable=False)
    qa_type: Mapped[QAType] = mapped_column(
        Enum(QAType, native_enum=False, length=32), nullable=False
    )
    quota_status: Mapped[QuotaStatus] = mapped_column(
        Enum(QuotaStatus, native_enum=False, length=16), nullable=False
    )
    analysis_status: Mapped[AnalysisStatus | None] = mapped_column(
        Enum(AnalysisStatus, native_enum=False, length=24), nullable=True
    )
    char_count: Mapped[int] = mapped_column(Integer, nullable=False)
    turn_count: Mapped[int] = mapped_column(Integer, nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rubric_version: Mapped[str] = mapped_column(String(80), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(80), nullable=False)
    scored_dimension_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[RiskLevel | None] = mapped_column(
        Enum(RiskLevel, native_enum=False, length=16), nullable=True
    )
    error_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Feedback(Base):
    __tablename__ = "feedback"

    analysis_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("analysis_attempts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    invite_code_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invite_codes.id", ondelete="CASCADE"), nullable=False
    )
    helpful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason_code: Mapped[FeedbackReason | None] = mapped_column(
        Enum(FeedbackReason, native_enum=False, length=24), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
