import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.domain.case_refined_v2 import REFINED_CASE_V2
from app.domain.rules import evaluate_turn, initial_session
from app.domain.scoring import ReportInput, score_report
from app.main import create_app
from app.repositories.sessions import decode_session_state


def test_refined_case_has_complete_multi_suspect_graph() -> None:
    case = REFINED_CASE_V2

    assert case.case_id == "refined-001-v2"
    assert len(case.suspects) == 3
    assert all(item.initial_statement for item in case.suspects)
    assert len(case.evidence) == 6
    assert len(case.lie_nodes) == 4
    assert {item.suspect_id for item in case.lie_nodes} == {"S01", "S02", "S03"}

    public = case.public_payload()
    assert len(public["suspects"]) == 3
    assert all("initialStatement" in item for item in public["suspects"])
    assert all("softSpot" not in item for item in public["suspects"])


def test_turns_are_scoped_to_selected_suspect() -> None:
    state = initial_session("ses_multi", case=REFINED_CASE_V2)
    assert state.active_suspect_id == "S01"
    assert len(state.suspect_states) == 3
    assert {item.suspect_id for item in state.messages} == {"S01", "S02", "S03"}

    lin_result = evaluate_turn(
        state,
        "打印文件的时间为什么是 22:34？",
        "calm",
        "E01",
        "S02",
        case=REFINED_CASE_V2,
    )
    assert lin_result.evidence_effect == "effective"
    assert lin_result.state.suspect_states["S02"].defense == 58
    assert lin_result.state.suspect_states["S01"].defense == 72
    assert lin_result.state.messages[-1].suspect_id == "S02"

    cheng_result = evaluate_turn(
        lin_result.state,
        "会议室的位置记录为什么显示你在这个时间离开？",
        "pressure",
        "E02",
        "S01",
        case=REFINED_CASE_V2,
    )
    assert cheng_result.evidence_effect == "effective"
    assert cheng_result.state.active_suspect_id == "S01"
    assert cheng_result.state.suspect_states["S01"].defense == 56
    assert cheng_result.state.suspect_states["S02"].defense == 58


def test_evidence_cannot_hit_another_suspects_lie() -> None:
    state = initial_session("ses_wrong_target", case=REFINED_CASE_V2)

    result = evaluate_turn(
        state,
        "打印文件的时间为什么是 22:34？",
        "calm",
        "E01",
        "S01",
        case=REFINED_CASE_V2,
    )

    assert result.evidence_effect == "used_ineffective"
    assert result.state.hit_lie_node_ids == []
    assert result.state.suspect_states["S01"].defense == 72


def test_refined_case_can_be_solved_through_all_four_contradictions() -> None:
    state = initial_session("ses_complete_graph", case=REFINED_CASE_V2)
    turns = [
        ("打印文件的时间为什么是 22:34？", "E01", "S02"),
        ("会议室的位置记录为什么显示你在这个时间离开？", "E02", "S01"),
        ("你的设备为什么越过权限登录共享账号？", "E03", "S03"),
        ("你的设备为什么用旧文件覆盖最终文件？", "E04", "S01"),
    ]
    for message, evidence_id, suspect_id in turns:
        result = evaluate_turn(
            state,
            message,
            "calm",
            evidence_id,
            suspect_id,
            case=REFINED_CASE_V2,
        )
        assert result.evidence_effect == "effective"
        state = result.state

    assert set(state.hit_lie_node_ids) == {"L01", "L02", "L03", "L04"}
    assert set(state.discovered_evidence_ids) == {
        "E01",
        "E02",
        "E03",
        "E04",
        "E05",
        "E06",
    }
    assert state.can_submit_report is True

    score = score_report(
        state,
        ReportInput(
            verdict_id="V01",
            motive_id="M01",
            method_id="H01",
            evidence_ids=["E02", "E04", "E06"],
        ),
        case=REFINED_CASE_V2,
    )
    assert score.total_score == 100
    assert {item["suspectId"] for item in score.hit_contradictions} == {
        "S01",
        "S02",
        "S03",
    }


def test_v1_session_migrates_with_legacy_eight_turn_limit() -> None:
    payload = {
        "schemaVersion": 1,
        "sessionId": "ses_legacy_v1",
        "caseId": "001",
        "turnCount": 3,
        "defense": 56,
        "hostility": 3,
        "defenseBand": "guarded",
    }

    migrated = decode_session_state(json.dumps(payload))

    assert migrated.schema_version == 2
    assert migrated.max_turns == 8
    assert migrated.active_suspect_id == "S01"
    assert migrated.suspect_states["S01"].defense == 56


def test_case_library_and_default_session_expose_suspect_statuses(
    tmp_path: Path,
) -> None:
    app = create_app(database_url=f"sqlite:///{tmp_path / 'multi-api.db'}")
    with TestClient(app) as client:
        cases = client.get("/api/v1/cases")
        created = client.post("/api/v1/sessions", json={})

        assert cases.status_code == 200
        assert cases.json()[0]["caseId"] == "refined-001-v2"
        assert created.status_code == 201
        body = created.json()
        assert body["caseId"] == "refined-001-v2"
        assert body["maxTurns"] == 12
        assert len(body["suspects"]) == 3

        turn = client.post(
            f"/api/v1/sessions/{body['sessionId']}/turns",
            json={
                "message": "打印文件的时间为什么是 22:34？",
                "tactic": "calm",
                "evidenceId": "E01",
                "suspectId": "S02",
                "requestId": "multi_turn_req_001",
            },
        )

    assert turn.status_code == 200
    result = turn.json()
    assert result["activeSuspectId"] == "S02"
    assert result["evidenceEffect"] == "effective"
    assert result["messages"][-1]["suspectId"] == "S02"
    suspect_by_id = {item["id"]: item for item in result["suspects"]}
    assert suspect_by_id["S02"]["defense"] == 58
    assert suspect_by_id["S01"]["defense"] == 72
