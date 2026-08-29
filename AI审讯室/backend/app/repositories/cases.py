from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Database
from app.domain.case_models import CaseSnapshot


class CaseAlreadyExistsError(RuntimeError):
    pass


class CaseRecord(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_code: Mapped[str] = mapped_column(String(24), nullable=False, unique=True)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    content_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ready")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class CaseRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create(self, snapshot: CaseSnapshot) -> CaseSnapshot:
        try:
            with self.database.session() as db_session:
                db_session.add(
                    CaseRecord(
                        id=snapshot.case_id,
                        case_code=snapshot.case_code,
                        schema_version=snapshot.schema_version,
                        source=snapshot.source,
                        model_name=snapshot.model_name,
                        content_json=snapshot.model_dump_json(by_alias=True),
                        status="ready",
                    )
                )
        except IntegrityError as exc:
            raise CaseAlreadyExistsError(snapshot.case_id) from exc
        return snapshot

    def get(self, case_id: str) -> CaseSnapshot | None:
        with self.database.session() as db_session:
            record = db_session.get(CaseRecord, case_id)
            if record is None or record.status != "ready":
                return None
            return CaseSnapshot.model_validate_json(record.content_json)
