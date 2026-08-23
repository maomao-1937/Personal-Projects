from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


def new_uuid() -> str:
    return str(uuid4())


class SummaryVersion(Base):
    __tablename__ = "summary_versions"
    __table_args__ = (UniqueConstraint("meeting_id", "version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    meeting_id: Mapped[str] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column()
    schema_version: Mapped[str] = mapped_column(String(16), default="1.0")
    content: Mapped[dict[str, object]] = mapped_column(JSON)
    quality_flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(32), default="ready_for_review", index=True)
    parent_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("summary_versions.id", ondelete="SET NULL"), nullable=True
    )
    created_source: Mapped[str] = mapped_column(String(32), default="model")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Delivery(Base):
    __tablename__ = "deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    summary_version_id: Mapped[str] = mapped_column(
        ForeignKey("summary_versions.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[str] = mapped_column(String(32))
    target_fingerprint: Mapped[str] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    receipt: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
