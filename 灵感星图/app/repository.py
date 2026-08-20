from __future__ import annotations

from uuid import UUID

from sqlalchemy import JSON, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool

from app.domain import Feedback, FeedbackCreate, Material, ProjectHypothesis


class Base(DeclarativeBase):
    pass


class MaterialRecord(Base):
    __tablename__ = "materials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class HypothesisRecord(Base):
    __tablename__ = "project_hypotheses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class FeedbackRecord(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    hypothesis_id: Mapped[str] = mapped_column(String(36), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class Repository:
    """Persistence boundary with mandatory user scoping on every read."""

    def __init__(self, database_url: str) -> None:
        options: dict = {}
        if database_url.startswith("sqlite"):
            options["connect_args"] = {"check_same_thread": False}
        if database_url.endswith(":memory:"):
            options["poolclass"] = StaticPool
        self._engine = create_engine(database_url, **options)

    def create_schema(self) -> None:
        Base.metadata.create_all(self._engine)

    def close(self) -> None:
        self._engine.dispose()

    def add_material(self, material: Material) -> Material:
        with Session(self._engine) as session:
            session.add(
                MaterialRecord(
                    id=str(material.id),
                    user_id=material.user_id,
                    payload=material.model_dump(mode="json"),
                )
            )
            session.commit()
        return material

    def get_material(self, user_id: str, material_id: UUID) -> Material | None:
        with Session(self._engine) as session:
            record = session.scalar(
                select(MaterialRecord).where(
                    MaterialRecord.id == str(material_id),
                    MaterialRecord.user_id == user_id,
                )
            )
            return Material.model_validate(record.payload) if record else None

    def list_materials(self, user_id: str) -> list[Material]:
        with Session(self._engine) as session:
            records = session.scalars(
                select(MaterialRecord)
                .where(MaterialRecord.user_id == user_id)
                .order_by(MaterialRecord.id)
            ).all()
            return [Material.model_validate(record.payload) for record in records]

    def update_material(
        self, user_id: str, material_id: UUID, material: Material
    ) -> Material | None:
        with Session(self._engine) as session:
            record = session.scalar(
                select(MaterialRecord).where(
                    MaterialRecord.id == str(material_id),
                    MaterialRecord.user_id == user_id,
                )
            )
            if record is None:
                return None
            record.payload = material.model_dump(mode="json")
            session.commit()
        return material

    def save_hypothesis(
        self, user_id: str, hypothesis: ProjectHypothesis
    ) -> ProjectHypothesis:
        owned = hypothesis.model_copy(update={"user_id": user_id})
        with Session(self._engine) as session:
            cited_ids = {str(item.material_id) for item in owned.source_contributions}
            if cited_ids:
                owned_ids = set(
                    session.scalars(
                        select(MaterialRecord.id).where(
                            MaterialRecord.user_id == user_id,
                            MaterialRecord.id.in_(cited_ids),
                        )
                    ).all()
                )
                if owned_ids != cited_ids:
                    raise ValueError(
                        "one or more cited materials do not belong to the user"
                    )
            session.add(
                HypothesisRecord(
                    id=str(owned.id),
                    user_id=user_id,
                    payload=owned.model_dump(mode="json"),
                )
            )
            session.commit()
        return owned

    def get_hypothesis(
        self, user_id: str, hypothesis_id: UUID
    ) -> ProjectHypothesis | None:
        with Session(self._engine) as session:
            record = session.scalar(
                select(HypothesisRecord).where(
                    HypothesisRecord.id == str(hypothesis_id),
                    HypothesisRecord.user_id == user_id,
                )
            )
            return ProjectHypothesis.model_validate(record.payload) if record else None

    def list_hypotheses(self, user_id: str) -> list[ProjectHypothesis]:
        with Session(self._engine) as session:
            records = session.scalars(
                select(HypothesisRecord)
                .where(HypothesisRecord.user_id == user_id)
                .order_by(HypothesisRecord.id)
            ).all()
            return [
                ProjectHypothesis.model_validate(record.payload) for record in records
            ]

    def add_feedback(
        self,
        user_id: str,
        hypothesis_id: UUID,
        data: FeedbackCreate,
    ) -> Feedback | None:
        if self.get_hypothesis(user_id, hypothesis_id) is None:
            return None
        feedback = Feedback(
            user_id=user_id,
            hypothesis_id=hypothesis_id,
            **data.model_dump(),
        )
        with Session(self._engine) as session:
            session.add(
                FeedbackRecord(
                    id=str(feedback.id),
                    user_id=user_id,
                    hypothesis_id=str(hypothesis_id),
                    payload=feedback.model_dump(mode="json"),
                )
            )
            session.commit()
        return feedback
