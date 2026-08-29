from __future__ import annotations

from pydantic import Field

from app.domain.case_001 import MANUAL_CASE
from app.domain.case_models import CaseOption, CaseSnapshot
from app.domain.types import DomainModel, GameSessionState


class ReportInput(DomainModel):
    verdict_id: str
    evidence_ids: list[str] = Field(min_length=1, max_length=3)
    motive_id: str
    method_id: str


class ScoreResult(DomainModel):
    total_score: int
    grade: str
    breakdown: dict[str, int]
    player_conclusion: dict[str, str]
    true_conclusion: dict[str, str]
    truth_summary: str
    truth_timeline: list[str]
    hit_contradictions: list[dict[str, str]]
    missed_contradictions: list[dict[str, str]]
    stats: dict[str, int]


def _option_label(options: list[CaseOption], option_id: str) -> str:
    for option in options:
        if option.id == option_id:
            return option.label
    return "未登记的选择"


def _grade(score: int) -> str:
    if score >= 90:
        return "S"
    if score >= 75:
        return "A"
    if score >= 60:
        return "B"
    if score >= 40:
        return "C"
    return "D"


def _efficiency_score(state: GameSessionState) -> int:
    if state.invalid_pressure_count == 0 and state.turn_count <= 6:
        return 5
    if state.invalid_pressure_count <= 1 and state.turn_count <= 7:
        return 4
    if state.invalid_pressure_count <= 1:
        return 3
    return 1


def score_report(
    state: GameSessionState,
    report: ReportInput,
    *,
    case: CaseSnapshot | None = None,
) -> ScoreResult:
    resolved_case = case or MANUAL_CASE
    truth = resolved_case.truth
    evidence_by_id = {item.id: item for item in resolved_case.evidence}
    evidence_score = sum(
        truth.core_evidence_weights.get(evidence_id, 0)
        for evidence_id in set(report.evidence_ids)
    )
    breakdown = {
        "truth": 35 if report.verdict_id == truth.verdict_id else 0,
        "motive": 20 if report.motive_id == truth.motive_id else 0,
        "method": 20 if report.method_id == truth.method_id else 0,
        "evidence": min(20, evidence_score),
        "efficiency": _efficiency_score(state),
    }
    total = sum(breakdown.values())
    hit_ids = set(state.hit_lie_node_ids)
    hit = [
        {"id": node.id, "claim": node.claim, "evidenceId": node.evidence_id}
        for node in resolved_case.lie_nodes
        if node.id in hit_ids
    ]
    missed = [
        {"id": node.id, "claim": node.claim, "evidenceId": node.evidence_id}
        for node in resolved_case.lie_nodes
        if node.id not in hit_ids
    ]
    selected_evidence_names = "、".join(
        evidence_by_id[evidence_id].name
        for evidence_id in report.evidence_ids
        if evidence_id in evidence_by_id
    )

    return ScoreResult(
        total_score=total,
        grade=_grade(total),
        breakdown=breakdown,
        player_conclusion={
            "verdict": _option_label(resolved_case.truth_options, report.verdict_id),
            "motive": _option_label(resolved_case.motive_options, report.motive_id),
            "method": _option_label(resolved_case.method_options, report.method_id),
            "evidence": selected_evidence_names or "未选择关键证据",
        },
        true_conclusion={
            "verdict_id": truth.verdict_id,
            "verdict": _option_label(resolved_case.truth_options, truth.verdict_id),
            "motive_id": truth.motive_id,
            "motive": _option_label(resolved_case.motive_options, truth.motive_id),
            "method_id": truth.method_id,
            "method": _option_label(resolved_case.method_options, truth.method_id),
        },
        truth_summary=truth.summary,
        truth_timeline=truth.timeline,
        hit_contradictions=hit,
        missed_contradictions=missed,
        stats={
            "turnCount": state.turn_count,
            "effectiveEvidenceCount": len(state.effective_evidence_ids),
            "invalidPressureCount": state.invalid_pressure_count,
        },
    )
