import re
from dataclasses import dataclass
from itertools import pairwise
from typing import Literal

from app.core.errors import TranscriptInvalid
from app.models import QAType
from app.schemas.analysis import ParsedTranscript, TranscriptTurn

LINE_PATTERN = re.compile(r"^\s*([^：:\s]{1,20})\s*[：:]\s*(.*?)\s*$")
CUSTOMER_BASE_LABELS = ("客户", "用户", "顾客", "买家")
EMPLOYEE_BASE_LABELS = {
    QAType.SALES: ("销售", "顾问", "员工"),
    QAType.CUSTOMER_SERVICE: ("客服", "坐席", "员工"),
}
CROSS_SCENARIO_LABELS = {
    QAType.SALES: ("客服", "坐席"),
    QAType.CUSTOMER_SERVICE: ("销售", "顾问"),
}


@dataclass(frozen=True, slots=True)
class TranscriptLimits:
    min_chars: int
    max_chars: int
    max_turns: int


def parse_transcript(
    text: str,
    qa_type: QAType | str,
    limits: TranscriptLimits,
) -> ParsedTranscript:
    normalized = text.strip()
    char_count = len(normalized)
    if char_count < limits.min_chars:
        raise TranscriptInvalid(
            "TRANSCRIPT_TOO_SHORT",
            f"对话至少需要 {limits.min_chars} 个字符。",
        )
    if char_count > limits.max_chars:
        raise TranscriptInvalid(
            "TRANSCRIPT_TOO_LONG",
            f"对话不能超过 {limits.max_chars} 个字符。",
        )

    scenario = QAType(qa_type)
    turns: list[TranscriptTurn] = []
    labels_by_role: dict[str, set[str]] = {"customer": set(), "employee": set()}
    for line_number, line in enumerate(normalized.splitlines(), start=1):
        if not line.strip():
            continue
        match = LINE_PATTERN.fullmatch(line)
        if match is None:
            raise TranscriptInvalid(
                "TRANSCRIPT_FORMAT_INVALID",
                f"第 {line_number} 行需要使用“角色：内容”的格式。",
            )
        speaker_label, content = match.groups()
        if not content:
            raise TranscriptInvalid(
                "TRANSCRIPT_FORMAT_INVALID",
                f"第 {line_number} 行缺少对话内容。",
            )
        role = _classify_role(speaker_label, scenario)
        if role is None:
            raise TranscriptInvalid(
                "TRANSCRIPT_ROLE_INVALID",
                f"无法识别第 {line_number} 行的角色“{speaker_label}”。",
            )
        labels_by_role[role].add(speaker_label)
        turns.append(
            TranscriptTurn(
                id=f"t{len(turns) + 1}",
                role=role,
                speaker_label=speaker_label,
                text=content,
            )
        )

    if len(turns) > limits.max_turns:
        raise TranscriptInvalid(
            "TRANSCRIPT_TOO_MANY_TURNS",
            f"对话不能超过 {limits.max_turns} 轮。",
        )
    if not turns:
        raise TranscriptInvalid(
            "TRANSCRIPT_FORMAT_INVALID",
            "没有找到有效对话，请使用“角色：内容”的格式。",
        )
    if any(len(labels) != 1 for labels in labels_by_role.values()):
        raise TranscriptInvalid(
            "TRANSCRIPT_ROLE_INVALID",
            "请只提供一名客户与一名被质检员工之间的对话。",
        )
    if not any(current.role != following.role for current, following in pairwise(turns)):
        raise TranscriptInvalid(
            "TRANSCRIPT_ROLE_INVALID",
            "对话必须包含客户与员工之间至少一次有效往返。",
        )

    return ParsedTranscript(
        qa_type=scenario,
        turns=tuple(turns),
        char_count=char_count,
        turn_count=len(turns),
    )


def _classify_role(
    speaker_label: str,
    qa_type: QAType,
) -> Literal["customer", "employee"] | None:
    if _matches_label(speaker_label, CUSTOMER_BASE_LABELS):
        return "customer"
    if _matches_label(speaker_label, EMPLOYEE_BASE_LABELS[qa_type]):
        return "employee"
    if _matches_label(speaker_label, CROSS_SCENARIO_LABELS[qa_type]):
        return None
    return None


def _matches_label(speaker_label: str, base_labels: tuple[str, ...]) -> bool:
    return any(
        speaker_label == base or (speaker_label.startswith(base) and len(speaker_label) > len(base))
        for base in base_labels
    )
