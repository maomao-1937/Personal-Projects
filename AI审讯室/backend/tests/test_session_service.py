import json
from pathlib import Path

import pytest

from app.core.database import Database
from app.domain.rules import evaluate_turn
from app.domain.scoring import ReportInput
from app.repositories.sessions import (
    ConcurrentSessionUpdateError,
    SessionRecord,
    SessionRepository,
    UnsupportedSessionSchemaError,
)
from app.services.game import (
    GameService,
    ReportLockedError,
    SessionForbiddenError,
)


@pytest.fixture()
def service(tmp_path: Path) -> GameService:
    database = Database(f"sqlite:///{tmp_path / 'sessions.db'}")
    database.create_schema()
    return GameService(SessionRepository(database))


def test_created_session_can_be_recovered(service: GameService) -> None:
    created = service.create_session("001")
    recovered = service.get_session(created.session_id)

    assert recovered.session_id == created.session_id
    assert recovered.discovered_evidence_ids == ["E01", "E02"]


def test_session_is_isolated_by_owner(service: GameService) -> None:
    created = service.create_session("001", owner_id="owner-a")

    with pytest.raises(SessionForbiddenError):
        service.get_session(created.session_id, owner_id="owner-b")
    with pytest.raises(SessionForbiddenError):
        service.submit_turn(
            created.session_id,
            message="请说明你的值班工作。",
            tactic="calm",
            evidence_id=None,
            owner_id="owner-b",
        )


def test_turn_is_persisted_transactionally(service: GameService) -> None:
    session = service.create_session("001")

    outcome = service.submit_turn(
        session.session_id,
        message="门禁记录显示 21:17 你打开侧门，为什么说没离开？",
        tactic="pressure",
        evidence_id="E02",
    )
    recovered = service.get_session(session.session_id)

    assert outcome.state.turn_count == 1
    assert recovered.turn_count == 1
    assert recovered.hit_lie_node_ids == ["L01"]


def test_turn_request_id_replays_first_result_without_spending_another_turn(
    service: GameService,
) -> None:
    session = service.create_session("001")

    first = service.submit_turn(
        session.session_id,
        message="请说明你的值班工作。",
        tactic="calm",
        evidence_id=None,
        request_id="turn_retry_001",
    )
    replay = service.submit_turn(
        session.session_id,
        message="这条重试不应重新执行。",
        tactic="pressure",
        evidence_id=None,
        request_id="turn_retry_001",
    )

    assert replay == first
    assert service.get_session(session.session_id).turn_count == 1


def test_stale_session_write_cannot_overwrite_newer_turn(service: GameService) -> None:
    session = service.create_session("001")
    first_state, first_revision = service.repository.get_versioned(session.session_id)
    stale_state, stale_revision = service.repository.get_versioned(session.session_id)
    assert first_state is not None and stale_state is not None

    first_outcome = evaluate_turn(first_state, "请说明你的值班工作。", "calm", None)
    stale_outcome = evaluate_turn(stale_state, "监控为什么中断？", "calm", None)
    service.repository.save(first_outcome.state, expected_revision=first_revision)

    with pytest.raises(ConcurrentSessionUpdateError):
        service.repository.save(stale_outcome.state, expected_revision=stale_revision)

    recovered = service.get_session(session.session_id)
    assert recovered.turn_count == 1
    assert recovered.messages[-2].text == "请说明你的值班工作。"


def test_v0_session_payload_is_migrated_and_future_version_is_rejected(
    service: GameService,
) -> None:
    session = service.create_session("001")
    with service.repository.database.session() as db_session:
        record = db_session.get(SessionRecord, session.session_id)
        payload = session.model_dump(by_alias=True, mode="json")
        payload.pop("schemaVersion")
        record.state_json = json.dumps(payload, ensure_ascii=False)

    assert service.get_session(session.session_id).schema_version == 1

    with service.repository.database.session() as db_session:
        record = db_session.get(SessionRecord, session.session_id)
        payload["schemaVersion"] = 999
        record.state_json = json.dumps(payload, ensure_ascii=False)

    with pytest.raises(UnsupportedSessionSchemaError):
        service.get_session(session.session_id)


def test_report_is_locked_before_gate(service: GameService) -> None:
    session = service.create_session("001")

    with pytest.raises(ReportLockedError):
        service.submit_report(
            session.session_id,
            ReportInput(
                verdict_id="V01",
                evidence_ids=["E02"],
                motive_id="M01",
                method_id="H01",
            ),
        )


def test_report_submission_is_idempotent(service: GameService) -> None:
    session = service.create_session("001")
    turns = [
        ("门禁记录显示 21:17 你打开侧门，为什么说没离开？", "pressure", "E02"),
        ("备份盘上为什么有你的指纹？", "calm", "E04"),
        ("撤回的转账是不是为了替妹妹还债？", "empathy", "E05"),
    ]
    for message, tactic, evidence_id in turns:
        service.submit_turn(session.session_id, message, tactic, evidence_id)

    report = ReportInput(
        verdict_id="V01",
        evidence_ids=["E02", "E04", "E05"],
        motive_id="M01",
        method_id="H01",
    )
    first = service.submit_report(session.session_id, report)
    second = service.submit_report(session.session_id, report)

    assert first == second


def test_report_write_wins_over_a_stale_interrogation_write(service: GameService) -> None:
    session = service.create_session("001")
    turns = [
        ("门禁记录显示 21:17 你打开侧门，为什么说没离开？", "pressure", "E02"),
        ("备份盘上为什么有你的指纹？", "calm", "E04"),
        ("撤回的转账是不是为了替妹妹还债？", "empathy", "E05"),
    ]
    for message, tactic, evidence_id in turns:
        service.submit_turn(session.session_id, message, tactic, evidence_id)

    stale_state, stale_revision = service.repository.get_versioned(session.session_id)
    assert stale_state is not None
    service.submit_report(
        session.session_id,
        ReportInput(
            verdict_id="V01",
            evidence_ids=["E02", "E04", "E05"],
            motive_id="M01",
            method_id="H01",
        ),
    )
    stale_outcome = evaluate_turn(stale_state, "我还要继续追问。", "calm", None)

    with pytest.raises(ConcurrentSessionUpdateError):
        service.repository.save(
            stale_outcome.state,
            expected_revision=stale_revision,
        )

    recovered = service.get_session(session.session_id)
    assert recovered.stage == "completed"
    assert recovered.report_result is not None
