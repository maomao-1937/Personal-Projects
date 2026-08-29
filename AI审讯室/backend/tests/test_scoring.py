from app.domain.rules import evaluate_turn, initial_session
from app.domain.scoring import ReportInput, score_report


def solved_state():
    state = initial_session("ses_score")
    turns = [
        ("门禁记录显示 21:17 你打开侧门，为什么说没离开？", "pressure", "E02"),
        ("备份盘上为什么有你的指纹？", "calm", "E04"),
        ("撤回的转账是不是为了替妹妹还债？", "empathy", "E05"),
    ]
    for message, tactic, evidence_id in turns:
        state = evaluate_turn(state, message, tactic, evidence_id).state
    return state


def test_correct_report_scores_one_hundred() -> None:
    result = score_report(
        solved_state(),
        ReportInput(
            verdict_id="V01",
            evidence_ids=["E02", "E04", "E05"],
            motive_id="M01",
            method_id="H01",
        ),
    )

    assert result.total_score == 100
    assert result.grade == "S"
    assert result.breakdown == {
        "truth": 35,
        "motive": 20,
        "method": 20,
        "evidence": 20,
        "efficiency": 5,
    }


def test_partial_report_scores_only_matching_dimensions() -> None:
    result = score_report(
        solved_state(),
        ReportInput(
            verdict_id="V01",
            evidence_ids=["E02"],
            motive_id="M02",
            method_id="H03",
        ),
    )

    assert result.breakdown["truth"] == 35
    assert result.breakdown["evidence"] == 7
    assert result.breakdown["motive"] == 0
    assert result.breakdown["method"] == 0


def test_failed_report_still_contains_full_truth() -> None:
    result = score_report(
        solved_state(),
        ReportInput(
            verdict_id="V03",
            evidence_ids=["E01"],
            motive_id="M03",
            method_id="H03",
        ),
    )

    assert result.total_score < 40
    assert result.grade == "D"
    assert len(result.truth_timeline) >= 4
    assert result.true_conclusion["verdict_id"] == "V01"


def test_same_report_is_deterministic() -> None:
    state = solved_state()
    report = ReportInput(
        verdict_id="V01",
        evidence_ids=["E02", "E04"],
        motive_id="M01",
        method_id="H01",
    )

    assert score_report(state, report) == score_report(state, report)


def test_dynamic_case_scores_against_its_own_truth() -> None:
    payload = deepcopy(CASE_001)
    payload["truth"]["verdict_id"] = "V02"
    dynamic_case = snapshot_from_legacy(
        payload,
        case_id="case_dynamic_score",
        case_code="CASE-DSCORE",
        source="llm",
        model_name="fake-model",
    )
    state = solved_state()
    state.case_id = dynamic_case.case_id

    result = score_report(
        state,
        ReportInput(
            verdict_id="V02",
            evidence_ids=["E02", "E04", "E05"],
            motive_id="M01",
            method_id="H01",
        ),
        case=dynamic_case,
    )

    assert result.breakdown["truth"] == 35
    assert result.true_conclusion["verdict_id"] == "V02"
from copy import deepcopy

from app.domain.case_001 import CASE_001
from app.domain.case_models import snapshot_from_legacy
