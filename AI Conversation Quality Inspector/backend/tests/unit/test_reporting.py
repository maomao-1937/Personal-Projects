import pytest

from app.core.errors import ModelOutputInvalid
from app.models import AnalysisStatus, QAType, RiskLevel
from app.schemas.analysis import (
    Confidence,
    DimensionName,
    DimensionStatus,
    Evidence,
    EvidenceType,
    IssueSeverity,
    MajorIssue,
    ModelAnalysisResult,
    ModelDimension,
    ParsedTranscript,
    TranscriptTurn,
)
from app.services.reporting import SAFE_STOP_REPLY, build_report

DIMENSION_NAMES = tuple(DimensionName)


def parsed_transcript(*, explicit_stop: bool = False) -> ParsedTranscript:
    customer_text = (
        "这个价格有些贵，不要再联系我。" if explicit_stop else "这个价格有些贵，我还需要比较一下。"
    )
    return ParsedTranscript(
        qa_type=QAType.SALES,
        turns=(
            TranscriptTurn(
                id="t1",
                role="customer",
                speaker_label="客户",
                text=customer_text,
            ),
            TranscriptTurn(
                id="t2",
                role="employee",
                speaker_label="销售",
                text="我们已经是最低价格了，今天必须决定。",
            ),
        ),
        char_count=50,
        turn_count=2,
    )


def model_result(
    scores: list[int],
    *,
    quote: str = "我们已经是最低价格了",
    duplicate_first_dimension: bool = False,
    include_evidence: bool = True,
) -> ModelAnalysisResult:
    dimensions: list[ModelDimension] = []
    for index, name in enumerate(DIMENSION_NAMES):
        dimension_name = DIMENSION_NAMES[0] if duplicate_first_dimension and index == 1 else name
        if index < len(scores):
            evidence = (
                [
                    Evidence(
                        type=EvidenceType.PROBLEMATIC_LANGUAGE,
                        turn_ids=["t2"],
                        quotes=[quote],
                        rationale="销售使用了无法核验的绝对化表达。",
                    )
                ]
                if include_evidence
                else []
            )
            dimensions.append(
                ModelDimension(
                    name=dimension_name,
                    status=DimensionStatus.SCORED,
                    score=scores[index],
                    summary="存在可定位的改进空间。",
                    evidence=evidence,
                    improvement="先澄清客户的真实顾虑，再给出可核验的信息。",
                    confidence=Confidence.HIGH,
                )
            )
        else:
            dimensions.append(
                ModelDimension(
                    name=dimension_name,
                    status=DimensionStatus.INSUFFICIENT_CONTEXT,
                    score=None,
                    summary="当前对话信息不足。",
                    evidence=[],
                    improvement=None,
                    confidence=Confidence.LOW,
                )
            )
    return ModelAnalysisResult(
        confidence=Confidence.HIGH,
        risk_level=RiskLevel.MEDIUM,
        risk_flags=["绝对化价格承诺"],
        dimensions=dimensions,
        major_issues=[
            MajorIssue(
                severity=IssueSeverity.HIGH,
                dimension=DimensionName.INFORMATION_ACCURACY,
                title="绝对化价格承诺",
                reason="当前没有产品政策可支持最低价结论。",
                evidence_turn_ids=["t2"],
            )
        ],
        suggested_reply="理解您的顾虑，方便说说主要在比较哪些方面吗？",
        limitations=["缺少产品价格政策，无法核验最低价说法。"],
    )


def test_total_score_uses_round_half_up() -> None:
    result = build_report(
        model_result(scores=[60, 61, 60, 61]),
        parsed_transcript(),
    )

    assert result.total_score == 61
    assert result.analysis_status == AnalysisStatus.SCORED
    assert result.scored_dimension_count == 4


def test_three_scored_dimensions_never_get_total_score() -> None:
    result = build_report(
        model_result(scores=[80, 70, 60]),
        parsed_transcript(),
    )

    assert result.analysis_status == AnalysisStatus.PARTIAL
    assert result.total_score is None


def test_zero_scored_dimensions_is_unable_to_score() -> None:
    result = build_report(model_result(scores=[]), parsed_transcript())

    assert result.analysis_status == AnalysisStatus.UNABLE_TO_SCORE
    assert result.total_score is None


def test_quote_must_exist_in_referenced_turn() -> None:
    with pytest.raises(ModelOutputInvalid) as captured:
        build_report(
            model_result(scores=[80, 70, 60, 50], quote="模型编造的原句"),
            parsed_transcript(),
        )

    assert captured.value.code == "MODEL_OUTPUT_INVALID"


def test_requires_six_unique_dimensions_and_scored_evidence() -> None:
    with pytest.raises(ModelOutputInvalid):
        build_report(
            model_result(scores=[80, 70, 60, 50], duplicate_first_dimension=True),
            parsed_transcript(),
        )
    with pytest.raises(ModelOutputInvalid):
        build_report(
            model_result(scores=[80, 70, 60, 50], include_evidence=False),
            parsed_transcript(),
        )


def test_major_issue_must_reference_known_turn() -> None:
    result = model_result(scores=[80, 70, 60, 50])
    result.major_issues[0].evidence_turn_ids = ["t99"]

    with pytest.raises(ModelOutputInvalid):
        build_report(result, parsed_transcript())


def test_explicit_stop_request_overrides_model_reply() -> None:
    result = build_report(
        model_result(scores=[80, 70, 60, 50]),
        parsed_transcript(explicit_stop=True),
    )

    assert result.suggested_reply == SAFE_STOP_REPLY
