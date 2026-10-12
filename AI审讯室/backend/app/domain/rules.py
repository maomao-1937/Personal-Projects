from __future__ import annotations

import re
from uuid import uuid4

from app.domain.case_001 import MANUAL_CASE
from app.domain.case_models import CaseSnapshot, LieNodeDefinition
from app.domain.types import (
    Claim,
    DefenseBand,
    GameSessionState,
    Message,
    SuspectSessionState,
    Tactic,
    TurnEvaluation,
)

MAX_TURNS = 12

TOPIC_KEYWORDS = {
    "时间": ("时间", "几点", "21:", "21：", "案发", "当晚", "那晚"),
    "位置": ("离开", "侧门", "走廊", "出去", "位置", "在哪里"),
    "门禁": ("门禁", "刷卡", "开门", "侧门"),
    "设备": ("备份盘", "硬盘", "读写器", "指纹", "触点", "接触", "拿走", "设备"),
    "款项": ("转账", "款项", "钱", "借款", "还债", "债务", "顾问", "动机"),
    "监控": ("监控", "检修", "升级", "中断", "暂停", "故障"),
    "手机": ("手机", "电话", "定位", "信号", "基站"),
    "身份": ("身份", "人员", "员工", "访客"),
    "权限": ("权限", "账户", "密码", "授权"),
    "文件": ("文件", "资料", "档案", "合同", "记录"),
}


class InvalidTurnError(ValueError):
    pass


class TurnLimitReachedError(ValueError):
    pass


def defense_band(defense: int) -> DefenseBand:
    if defense >= 70:
        return DefenseBand.CALM
    if defense >= 40:
        return DefenseBand.GUARDED
    if defense >= 15:
        return DefenseBand.SHAKEN
    return DefenseBand.BREAKING


def normalize_question(message: str) -> str:
    return re.sub(r"[\s，。！？、；：,.!?;:'\"“”‘’]", "", message).lower()


def detect_topics(message: str, case: CaseSnapshot) -> set[str]:
    topics = {
        topic
        for topic, keywords in TOPIC_KEYWORDS.items()
        if any(keyword in message for keyword in keywords)
    }
    if re.search(r"(?<!\d)(?:[01]?\d|2[0-3])[:：][0-5]\d(?!\d)", message) or re.search(
        r"(?:凌晨|早上|上午|中午|下午|晚上)?[一二三四五六七八九十两\d]{1,3}点(?:半|[一二三四五六七八九十\d]{1,3}分)?",
        message,
    ):
        topics.add("时间")
    # Generated cases may introduce their own concise topic labels. A literal
    # mention is deterministic and complements the common Chinese keywords.
    for node in case.lie_nodes:
        topics.update(topic for topic in node.topics if topic.lower() in message.lower())
    return topics


def can_submit_report(state: GameSessionState) -> bool:
    return (
        state.turn_count >= 3
        and len(state.discovered_evidence_ids) >= 2
        and len(state.effective_evidence_ids) >= 1
    )


def initial_session(
    session_id: str,
    *,
    case: CaseSnapshot | None = None,
) -> GameSessionState:
    resolved_case = case or MANUAL_CASE
    primary_suspect_id = resolved_case.suspect.id
    state = GameSessionState(
        session_id=session_id,
        case_id=resolved_case.case_id,
        max_turns=MAX_TURNS,
        active_suspect_id=primary_suspect_id,
        suspect_states={
            item.id: SuspectSessionState(suspect_id=item.id)
            for item in resolved_case.suspects
        },
        discovered_evidence_ids=[item.id for item in resolved_case.evidence if item.public],
    )
    for item in resolved_case.suspects:
        state.messages.append(
            Message(
                id=f"msg_{uuid4().hex}",
                role="suspect",
                text=item.initial_statement or resolved_case.initial_statement,
                turn=0,
                suspect_id=item.id,
            )
        )
    return state


def _recent_questions(state: GameSessionState, suspect_id: str) -> list[str]:
    questions = [
        message.text
        for message in state.messages
        if message.role == "detective"
        and (message.suspect_id or state.active_suspect_id) == suspect_id
    ]
    return questions[-2:]


def _matching_lie_node(
    case: CaseSnapshot,
    topics: set[str],
    evidence_id: str | None,
    suspect_id: str,
) -> LieNodeDefinition | None:
    if not evidence_id:
        return None
    for node in case.lie_nodes:
        node_suspect_id = node.suspect_id or case.suspect.id
        if (
            node_suspect_id == suspect_id
            and node.evidence_id == evidence_id
            and set(node.topics).issubset(topics)
        ):
            return node
    return None


def _topic_lie_node(
    case: CaseSnapshot,
    topics: set[str],
    hit_ids: list[str],
    suspect_id: str,
) -> LieNodeDefinition | None:
    for node in case.lie_nodes:
        node_suspect_id = node.suspect_id or case.suspect.id
        if (
            node_suspect_id == suspect_id
            and node.id not in hit_ids
            and set(node.topics).issubset(topics)
        ):
            return node
    return None


def _hits_soft_spot(message: str, case: CaseSnapshot, suspect_id: str) -> bool:
    normalized_message = normalize_question(message)
    suspect = case.suspect_by_id(suspect_id)
    return any(
        normalize_question(keyword) in normalized_message
        for keyword in suspect.soft_spot_keywords
    )


def _append_message(
    state: GameSessionState,
    *,
    role: str,
    text: str,
    tactic: Tactic | None = None,
    evidence_id: str | None = None,
    evidence_effect: str = "none",
    suspect_id: str | None = None,
) -> None:
    state.messages.append(
        Message(
            id=f"msg_{uuid4().hex}",
            role=role,
            text=text,
            turn=state.turn_count,
            tactic=tactic,
            evidence_id=evidence_id,
            evidence_effect=evidence_effect,
            suspect_id=suspect_id,
        )
    )


def evaluate_turn(
    state: GameSessionState,
    message: str,
    tactic: str | Tactic,
    evidence_id: str | None,
    suspect_id: str | None = None,
    *,
    case: CaseSnapshot | None = None,
) -> TurnEvaluation:
    resolved_case = case or MANUAL_CASE
    clean_message = message.strip()
    if not 1 <= len(clean_message) <= 200:
        raise InvalidTurnError("问题长度必须为 1–200 个字符。")
    if state.turn_count >= state.max_turns or state.stage in {"report_required", "completed"}:
        raise TurnLimitReachedError("本局审讯回合已用完。")

    resolved_suspect_id = suspect_id or state.active_suspect_id or resolved_case.suspect.id
    try:
        resolved_suspect = resolved_case.suspect_by_id(resolved_suspect_id)
    except ValueError as exc:
        raise InvalidTurnError("没有找到这名嫌疑人。") from exc

    try:
        tactic_value = tactic if isinstance(tactic, Tactic) else Tactic(tactic)
    except ValueError as exc:
        raise InvalidTurnError("未知的审讯策略。") from exc

    next_state = state.model_copy(deep=True)
    next_state.stage = "interrogation"
    next_state.active_suspect_id = resolved_suspect_id
    suspect_state = next_state.suspect_states.setdefault(
        resolved_suspect_id,
        SuspectSessionState(suspect_id=resolved_suspect_id),
    )
    # Keep the legacy fields usable for clients that have not adopted
    # suspectStates yet.
    next_state.defense = suspect_state.defense
    next_state.hostility = suspect_state.hostility
    next_state.defense_band = suspect_state.defense_band
    next_state.turn_count += 1
    next_state.selected_evidence_id = evidence_id
    normalized = normalize_question(clean_message)
    repeated = normalized in {
        normalize_question(item)
        for item in _recent_questions(state, resolved_suspect_id)
    }
    topics = detect_topics(clean_message, resolved_case)
    evidence_effect = "none"
    new_evidence_ids: list[str] = []
    new_claim_ids: list[str] = []
    invalid_pressure = False
    response_key = "background"

    if evidence_id and evidence_id not in next_state.discovered_evidence_ids:
        raise InvalidTurnError("这条证据尚未发现。")
    evidence_by_id = {item.id: item for item in resolved_case.evidence}
    if evidence_id and evidence_id not in evidence_by_id:
        raise InvalidTurnError("没有找到这条证据。")

    if repeated:
        response_key = "repeated"
    else:
        matching_node = _matching_lie_node(
            resolved_case,
            topics,
            evidence_id,
            resolved_suspect_id,
        )
        if matching_node and matching_node.id not in next_state.hit_lie_node_ids:
            evidence_effect = "effective"
            node_id = matching_node.id
            next_state.hit_lie_node_ids.append(node_id)
            if evidence_id not in next_state.effective_evidence_ids:
                next_state.effective_evidence_ids.append(evidence_id)
            suspect_state.defense = max(
                0, suspect_state.defense + matching_node.defense_delta
            )
            for unlocked in matching_node.unlock_evidence_ids:
                if unlocked not in next_state.discovered_evidence_ids:
                    next_state.discovered_evidence_ids.append(unlocked)
                    new_evidence_ids.append(unlocked)
            claim = Claim(
                id=f"C_{node_id}",
                text=matching_node.acknowledgement,
                source=f"第 {next_state.turn_count} 回合回答 / 证据 {evidence_id}",
                turn=next_state.turn_count,
                kind="contradiction",
                suspect_id=resolved_suspect_id,
            )
            next_state.claims.append(claim)
            new_claim_ids.append(claim.id)
            response_key = f"effective_{node_id}"
        elif evidence_id:
            evidence_effect = "used_ineffective"
            response_key = "irrelevant"
        elif tactic_value == Tactic.PRESSURE:
            suspect_state.hostility = min(100, suspect_state.hostility + 3)
            suspect_state.invalid_pressure_count += 1
            next_state.invalid_pressure_count += 1
            invalid_pressure = True
            response_key = "pressure"
        elif tactic_value == Tactic.EMPATHY and _hits_soft_spot(
            clean_message, resolved_case, resolved_suspect_id
        ):
            soft_claim_id = f"C_SOFT_{resolved_suspect_id}"
            if not any(claim.id == soft_claim_id for claim in next_state.claims):
                suspect_state.defense = max(0, suspect_state.defense - 5)
                claim = Claim(
                    id=soft_claim_id,
                    text=resolved_suspect.soft_spot_acknowledgement,
                    source=f"第 {next_state.turn_count} 回合回答",
                    turn=next_state.turn_count,
                    kind="empathy",
                    suspect_id=resolved_suspect_id,
                )
                next_state.claims.append(claim)
                new_claim_ids.append(claim.id)
            response_key = "empathy"
        elif _topic_lie_node(
            resolved_case,
            topics,
            next_state.hit_lie_node_ids,
            resolved_suspect_id,
        ):
            suspect_state.defense = max(0, suspect_state.defense - 2)
            response_key = "probing"

        if (
            resolved_case.case_id == MANUAL_CASE.case_id
            and "手机" in topics
            and "E03" not in next_state.discovered_evidence_ids
        ):
            next_state.discovered_evidence_ids.append("E03")
            new_evidence_ids.append("E03")

    suspect_state.defense_band = defense_band(suspect_state.defense)
    next_state.defense = suspect_state.defense
    next_state.hostility = suspect_state.hostility
    next_state.defense_band = suspect_state.defense_band
    suspect_nodes = resolved_case.lie_nodes_for(resolved_suspect_id)
    if (
        suspect_state.defense <= 14
        and suspect_nodes
        and all(node.id in next_state.hit_lie_node_ids for node in suspect_nodes)
    ):
        response_key = "confession"

    next_state.can_submit_report = can_submit_report(next_state)
    if next_state.turn_count >= next_state.max_turns:
        next_state.stage = "report_required"
    elif next_state.can_submit_report:
        next_state.stage = "report_ready"

    reply = resolved_case.reply_templates[response_key]
    _append_message(
        next_state,
        role="detective",
        text=clean_message,
        tactic=tactic_value,
        evidence_id=evidence_id,
        evidence_effect=evidence_effect,
        suspect_id=resolved_suspect_id,
    )
    _append_message(
        next_state,
        role="suspect",
        text=reply,
        suspect_id=resolved_suspect_id,
    )

    return TurnEvaluation(
        state=next_state,
        reply=reply,
        evidence_effect=evidence_effect,
        new_evidence_ids=new_evidence_ids,
        new_claim_ids=new_claim_ids,
        is_repeated=repeated,
        invalid_pressure=invalid_pressure,
        force_report=next_state.turn_count >= next_state.max_turns,
    )
