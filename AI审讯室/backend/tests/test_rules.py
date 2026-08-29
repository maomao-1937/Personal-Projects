import pytest
from copy import deepcopy

from app.domain.case_001 import CASE_001
from app.domain.case_models import snapshot_from_legacy
from app.domain.rules import (
    InvalidTurnError,
    TurnLimitReachedError,
    can_submit_report,
    evaluate_turn,
    initial_session,
)


def test_correct_evidence_and_topic_hits_lie_node() -> None:
    state = initial_session("ses_test")

    outcome = evaluate_turn(
        state,
        message="你说没离开档案室，为什么 21:17 你的门禁卡打开了侧门？",
        tactic="pressure",
        evidence_id="E02",
    )

    assert outcome.evidence_effect == "effective"
    assert "L01" in outcome.state.hit_lie_node_ids
    assert outcome.state.defense == 56
    assert "E04" in outcome.state.discovered_evidence_ids
    assert outcome.state.defense_band == "guarded"


def test_irrelevant_evidence_does_not_lower_defense() -> None:
    state = initial_session("ses_test")

    outcome = evaluate_turn(
        state,
        message="你为什么要拿走备份盘？",
        tactic="pressure",
        evidence_id="E01",
    )

    assert outcome.evidence_effect == "used_ineffective"
    assert outcome.state.defense == state.defense
    assert outcome.state.hostility == state.hostility


def test_repeating_one_of_the_last_two_questions_has_no_effect() -> None:
    state = initial_session("ses_test")
    first = evaluate_turn(
        state,
        message="你案发时到底在哪里？",
        tactic="calm",
        evidence_id=None,
    )

    repeated = evaluate_turn(
        first.state,
        message="你案发时到底在哪里？",
        tactic="pressure",
        evidence_id="E02",
    )

    assert repeated.is_repeated is True
    assert repeated.evidence_effect == "none"
    assert repeated.state.defense == first.state.defense
    assert repeated.state.hostility == first.state.hostility


def test_pressure_without_evidence_only_increases_hostility() -> None:
    state = initial_session("ses_test")

    outcome = evaluate_turn(
        state,
        message="你最好现在就承认。",
        tactic="pressure",
        evidence_id=None,
    )

    assert outcome.state.defense == state.defense
    assert outcome.state.hostility == 3
    assert outcome.invalid_pressure is True


def test_empathy_on_soft_spot_lowers_defense_once() -> None:
    state = initial_session("ses_test")

    first = evaluate_turn(
        state,
        message="你是为了替妹妹还债才这么害怕吗？",
        tactic="empathy",
        evidence_id=None,
    )
    second = evaluate_turn(
        first.state,
        message="你是在保护妹妹，对吗？",
        tactic="empathy",
        evidence_id=None,
    )

    assert first.state.defense == 67
    assert second.state.defense == 67


def test_report_gate_requires_turns_evidence_and_effective_hit() -> None:
    state = initial_session("ses_test")
    assert can_submit_report(state) is False

    state.turn_count = 3
    assert can_submit_report(state) is False

    state.hit_lie_node_ids = ["L01"]
    state.effective_evidence_ids = ["E02"]
    assert can_submit_report(state) is True


def test_eighth_turn_forces_report() -> None:
    state = initial_session("ses_test")
    state.turn_count = 7

    outcome = evaluate_turn(
        state,
        message="请最后解释一次你的时间线。",
        tactic="calm",
        evidence_id=None,
    )

    assert outcome.state.turn_count == 8
    assert outcome.force_report is True
    assert outcome.state.stage == "report_required"

    with pytest.raises(TurnLimitReachedError):
        evaluate_turn(outcome.state, "第九个问题", "calm", None)


def test_question_length_accepts_200_and_rejects_blank_or_201() -> None:
    state = initial_session("ses_test")

    accepted = evaluate_turn(state, "问" * 200, "calm", None)
    assert accepted.state.turn_count == 1
    with pytest.raises(InvalidTurnError):
        evaluate_turn(state, "   ", "calm", None)
    with pytest.raises(InvalidTurnError):
        evaluate_turn(state, "问" * 201, "calm", None)


def test_dynamic_case_uses_its_own_evidence_mapping() -> None:
    payload = deepcopy(CASE_001)
    payload["lie_nodes"][0]["evidence_id"] = "E01"
    payload["lie_nodes"][0]["topics"] = ["监控"]
    dynamic_case = snapshot_from_legacy(
        payload,
        case_id="case_dynamic_rules",
        case_code="CASE-DRULE",
        source="llm",
        model_name="fake-model",
    )
    state = initial_session("ses_dynamic", case=dynamic_case)

    outcome = evaluate_turn(
        state,
        message="监控为什么在案发时被暂停？",
        tactic="calm",
        evidence_id="E01",
        case=dynamic_case,
    )

    assert outcome.evidence_effect == "effective"
    assert outcome.state.case_id == "case_dynamic_rules"
    assert outcome.state.hit_lie_node_ids == ["L01"]


def test_generic_empathy_words_do_not_reveal_a_generated_soft_spot() -> None:
    payload = deepcopy(CASE_001)
    payload["suspect"]["soft_spot"] = "曾丢失一枚家族纪念徽章。"
    payload["suspect"]["soft_spot_keywords"] = ["纪念徽章", "家族徽章"]
    payload["suspect"]["soft_spot_acknowledgement"] = (
        "承认一件家庭纪念物会影响自己的情绪。"
    )
    dynamic_case = snapshot_from_legacy(
        payload,
        case_id="case_dynamic_empathy",
        case_code="CASE-DEMP",
        source="llm",
        model_name="fake-model",
    )
    state = initial_session("ses_dynamic_empathy", case=dynamic_case)

    result = evaluate_turn(
        state,
        "你是不是害怕、想保护某个人？",
        "empathy",
        None,
        case=dynamic_case,
    )

    assert result.state.defense == state.defense
    assert all(claim.id != "C_SOFT" for claim in result.state.claims)
