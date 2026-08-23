from decimal import ROUND_HALF_UP, Decimal

from app.core.errors import ModelOutputInvalid
from app.models import AnalysisStatus
from app.schemas.analysis import (
    AnalysisReport,
    DimensionName,
    DimensionStatus,
    ModelAnalysisResult,
    ModelDimension,
    ParsedTranscript,
)

SAFE_STOP_REPLY = "好的，感谢你的明确说明，我们不会再继续打扰。祝你一切顺利。"
EXPLICIT_STOP_PHRASES = (
    "不要再联系我",
    "别再联系我",
    "不要联系我",
    "请停止联系",
    "请别再联系",
    "不需要，请停止",
    "不想再收到",
)


def build_report(
    model_result: ModelAnalysisResult,
    transcript: ParsedTranscript,
) -> AnalysisReport:
    ordered_dimensions = _validate_dimensions(model_result.dimensions, transcript)
    _validate_major_issues(model_result, transcript, ordered_dimensions)

    scored_dimensions = [
        dimension for dimension in ordered_dimensions if dimension.status == DimensionStatus.SCORED
    ]
    scored_count = len(scored_dimensions)
    if scored_count >= 4:
        analysis_status = AnalysisStatus.SCORED
        total_score = _round_average([dimension.score for dimension in scored_dimensions])
    elif scored_count:
        analysis_status = AnalysisStatus.PARTIAL
        total_score = None
    else:
        analysis_status = AnalysisStatus.UNABLE_TO_SCORE
        total_score = None

    suggested_reply = model_result.suggested_reply
    if _contains_explicit_stop(transcript):
        suggested_reply = SAFE_STOP_REPLY

    return AnalysisReport(
        qa_type=transcript.qa_type,
        analysis_status=analysis_status,
        total_score=total_score,
        scored_dimension_count=scored_count,
        confidence=model_result.confidence,
        risk_level=model_result.risk_level,
        risk_flags=model_result.risk_flags,
        dimensions=ordered_dimensions,
        major_issues=model_result.major_issues,
        suggested_reply=suggested_reply,
        limitations=model_result.limitations,
    )


def _validate_dimensions(
    dimensions: list[ModelDimension],
    transcript: ParsedTranscript,
) -> list[ModelDimension]:
    expected_names = set(DimensionName)
    actual_names = [dimension.name for dimension in dimensions]
    if len(actual_names) != len(expected_names) or set(actual_names) != expected_names:
        raise ModelOutputInvalid("模型必须返回六个完整且唯一的质检维度。")

    turns_by_id = {turn.id: turn for turn in transcript.turns}
    for dimension in dimensions:
        if dimension.status == DimensionStatus.SCORED:
            if dimension.score is None:
                raise ModelOutputInvalid("可评分维度缺少分数。")
            if not dimension.evidence:
                raise ModelOutputInvalid("可评分维度缺少原文证据。")
            if not dimension.improvement or not dimension.improvement.strip():
                raise ModelOutputInvalid("可评分维度缺少具体改进动作。")
        elif dimension.score is not None:
            raise ModelOutputInvalid("不可评分维度不能包含分数。")

        for evidence in dimension.evidence:
            if len(evidence.turn_ids) != len(evidence.quotes):
                raise ModelOutputInvalid("证据轮次与原句数量不一致。")
            for turn_id, quote in zip(
                evidence.turn_ids,
                evidence.quotes,
                strict=True,
            ):
                turn = turns_by_id.get(turn_id)
                if turn is None:
                    raise ModelOutputInvalid("证据引用了不存在的对话轮次。")
                if not quote.strip() or quote not in turn.text:
                    raise ModelOutputInvalid("证据原句与引用轮次不一致。")

    dimensions_by_name = {dimension.name: dimension for dimension in dimensions}
    return [dimensions_by_name[name] for name in DimensionName]


def _validate_major_issues(
    model_result: ModelAnalysisResult,
    transcript: ParsedTranscript,
    dimensions: list[ModelDimension],
) -> None:
    if len(model_result.major_issues) > 3:
        raise ModelOutputInvalid("主要问题不能超过三条。")
    dimension_names = {dimension.name for dimension in dimensions}
    turn_ids = {turn.id for turn in transcript.turns}
    for issue in model_result.major_issues:
        if issue.dimension not in dimension_names:
            raise ModelOutputInvalid("主要问题引用了不存在的质检维度。")
        if not set(issue.evidence_turn_ids).issubset(turn_ids):
            raise ModelOutputInvalid("主要问题引用了不存在的对话轮次。")


def _round_average(scores: list[int | None]) -> int:
    numeric_scores = [score for score in scores if score is not None]
    average = sum(Decimal(score) for score in numeric_scores) / Decimal(len(numeric_scores))
    return int(average.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _contains_explicit_stop(transcript: ParsedTranscript) -> bool:
    return any(
        phrase in turn.text
        for turn in transcript.turns
        if turn.role == "customer"
        for phrase in EXPLICIT_STOP_PHRASES
    )
