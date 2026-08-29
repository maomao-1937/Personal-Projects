from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from time import monotonic, sleep

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Database
from app.domain.types import GameSessionState, TurnEvaluation


class ConcurrentSessionUpdateError(RuntimeError):
    pass


class UnsupportedSessionSchemaError(RuntimeError):
    pass


class DuplicateTurnRequestError(RuntimeError):
    pass


CURRENT_SESSION_SCHEMA_VERSION = 1


def _migrate_v0_to_v1(payload: dict) -> dict:
    return {**payload, "schemaVersion": 1}


SESSION_MIGRATIONS = {0: _migrate_v0_to_v1}


def decode_session_state(raw_payload: str) -> GameSessionState:
    payload = json.loads(raw_payload)
    version = payload.get("schemaVersion", 0)
    while version < CURRENT_SESSION_SCHEMA_VERSION:
        migration = SESSION_MIGRATIONS.get(version)
        if migration is None:
            raise UnsupportedSessionSchemaError(f"missing migration for v{version}")
        payload = migration(payload)
        version = payload["schemaVersion"]
    if version != CURRENT_SESSION_SCHEMA_VERSION:
        raise UnsupportedSessionSchemaError(f"unsupported session schema v{version}")
    return GameSessionState.model_validate(payload)


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    case_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(32), nullable=False)
    state_json: Mapped[str] = mapped_column(Text, nullable=False)
    report_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TurnRequestRecord(Base):
    __tablename__ = "turn_requests"

    session_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    request_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    outcome_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class SessionRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create(
        self,
        state: GameSessionState,
        owner_id: str = "local-development",
    ) -> GameSessionState:
        payload = state.model_dump_json(by_alias=True)
        with self.database.session() as db_session:
            db_session.add(
                SessionRecord(
                    id=state.session_id,
                    owner_id=owner_id,
                    case_id=state.case_id,
                    stage=state.stage,
                    state_json=payload,
                )
            )
        return state

    def get(
        self,
        session_id: str,
        owner_id: str = "local-development",
    ) -> GameSessionState | None:
        state, _ = self.get_versioned(session_id, owner_id=owner_id)
        return state

    def get_owner_id(self, session_id: str) -> str | None:
        with self.database.session() as db_session:
            return db_session.scalar(
                select(SessionRecord.owner_id).where(SessionRecord.id == session_id)
            )

    def get_versioned(
        self,
        session_id: str,
        owner_id: str = "local-development",
    ) -> tuple[GameSessionState | None, int]:
        with self.database.session() as db_session:
            record = db_session.scalar(
                select(SessionRecord).where(
                    SessionRecord.id == session_id,
                    SessionRecord.owner_id == owner_id,
                )
            )
            if record is None:
                return None, 0
            return decode_session_state(record.state_json), record.revision

    def save(
        self,
        state: GameSessionState,
        *,
        expected_revision: int,
        owner_id: str = "local-development",
        report_result: dict | None = None,
        turn_replay: tuple[str, TurnEvaluation] | None = None,
    ) -> GameSessionState:
        values: dict = {
            "stage": state.stage,
            "state_json": state.model_dump_json(by_alias=True),
            "revision": SessionRecord.revision + 1,
            "updated_at": datetime.now(timezone.utc),
        }
        if report_result is not None:
            values["report_json"] = json.dumps(report_result, ensure_ascii=False)

        statement = update(SessionRecord).where(
            SessionRecord.id == state.session_id,
            SessionRecord.owner_id == owner_id,
            SessionRecord.revision == expected_revision,
        )
        if report_result is not None:
            statement = statement.where(SessionRecord.report_json.is_(None))

        try:
            with self.database.session() as db_session:
                result = db_session.execute(statement.values(**values))
                if result.rowcount != 1:
                    raise ConcurrentSessionUpdateError(state.session_id)
                if turn_replay is not None:
                    request_id, outcome = turn_replay
                    replay_update = db_session.execute(
                        update(TurnRequestRecord)
                        .where(
                            TurnRequestRecord.session_id == state.session_id,
                            TurnRequestRecord.request_id == request_id,
                            TurnRequestRecord.outcome_json.is_(None),
                        )
                        .values(outcome_json=outcome.model_dump_json(by_alias=True))
                    )
                    if replay_update.rowcount != 1:
                        raise DuplicateTurnRequestError(request_id)
        except IntegrityError as exc:
            if turn_replay is not None:
                raise DuplicateTurnRequestError(turn_replay[0]) from exc
            raise
        return state

    def get_turn_replay(
        self,
        session_id: str,
        request_id: str,
        owner_id: str = "local-development",
    ) -> TurnEvaluation | None:
        with self.database.session() as db_session:
            record = db_session.scalar(
                select(TurnRequestRecord)
                .join(SessionRecord, SessionRecord.id == TurnRequestRecord.session_id)
                .where(
                    TurnRequestRecord.session_id == session_id,
                    TurnRequestRecord.request_id == request_id,
                    SessionRecord.owner_id == owner_id,
                )
            )
            if record is None:
                return None
            if record.outcome_json is None:
                return None
            return TurnEvaluation.model_validate_json(record.outcome_json)

    def claim_turn_request(
        self,
        session_id: str,
        request_id: str,
        owner_id: str = "local-development",
    ) -> bool:
        stale_before = datetime.now(timezone.utc) - timedelta(seconds=120)
        try:
            with self.database.session() as db_session:
                owned_session_id = db_session.scalar(
                    select(SessionRecord.id).where(
                        SessionRecord.id == session_id,
                        SessionRecord.owner_id == owner_id,
                    )
                )
                if owned_session_id is None:
                    return False
                db_session.execute(
                    delete(TurnRequestRecord).where(
                        TurnRequestRecord.session_id == session_id,
                        TurnRequestRecord.request_id == request_id,
                        TurnRequestRecord.outcome_json.is_(None),
                        TurnRequestRecord.created_at < stale_before,
                    )
                )
                db_session.add(
                    TurnRequestRecord(
                        session_id=session_id,
                        request_id=request_id,
                        outcome_json=None,
                    )
                )
        except IntegrityError:
            return False
        return True

    def wait_for_turn_replay(
        self,
        session_id: str,
        request_id: str,
        *,
        owner_id: str = "local-development",
        timeout_seconds: float = 0.5,
    ) -> TurnEvaluation | None:
        deadline = monotonic() + timeout_seconds
        while monotonic() < deadline:
            replay = self.get_turn_replay(
                session_id,
                request_id,
                owner_id=owner_id,
            )
            if replay is not None:
                return replay
            sleep(0.05)
        return self.get_turn_replay(session_id, request_id, owner_id=owner_id)

    def release_turn_request(
        self,
        session_id: str,
        request_id: str,
        owner_id: str = "local-development",
    ) -> None:
        with self.database.session() as db_session:
            db_session.execute(
                delete(TurnRequestRecord).where(
                    TurnRequestRecord.session_id == session_id,
                    TurnRequestRecord.request_id == request_id,
                    TurnRequestRecord.outcome_json.is_(None),
                    TurnRequestRecord.session_id.in_(
                        select(SessionRecord.id).where(
                            SessionRecord.owner_id == owner_id
                        )
                    ),
                )
            )

    def get_report(
        self,
        session_id: str,
        owner_id: str = "local-development",
    ) -> dict | None:
        with self.database.session() as db_session:
            record = db_session.scalar(
                select(SessionRecord).where(
                    SessionRecord.id == session_id,
                    SessionRecord.owner_id == owner_id,
                )
            )
            if record is None or record.report_json is None:
                return None
            return json.loads(record.report_json)
