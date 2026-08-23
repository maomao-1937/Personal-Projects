from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import AnalysisStatus, QAType, RiskLevel


class Confidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DimensionName(StrEnum):
    NEEDS_UNDERSTANDING = "需求理解"
    EMOTION_TONE = "情绪与语气"
    INFORMATION_ACCURACY = "信息准确性"
    OBJECTION_HANDLING = "异议处理"
    NEXT_STEP = "推进能力"
    RISK_LANGUAGE = "风险话术"


class DimensionStatus(StrEnum):
    SCORED = "scored"
    NOT_APPLICABLE = "not_applicable"
    INSUFFICIENT_CONTEXT = "insufficient_context"


class EvidenceType(StrEnum):
    PROBLEMATIC_LANGUAGE = "problematic_language"
    MISSED_OPPORTUNITY = "missed_opportunity"
    POSITIVE_BEHAVIOR = "positive_behavior"


class IssueSeverity(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TranscriptTurn(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str = Field(pattern=r"^t[1-9][0-9]*$")
    role: Literal["customer", "employee"]
    speaker_label: str = Field(min_length=1, max_length=20)
    text: str = Field(min_length=1)


class ParsedTranscript(BaseModel):
    model_config = ConfigDict(frozen=True)

    qa_type: QAType
    turns: tuple[TranscriptTurn, ...]
    char_count: int = Field(ge=0)
    turn_count: int = Field(ge=0)


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    qa_type: QAType
    transcript: str = Field(min_length=1)


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: EvidenceType
    turn_ids: list[str] = Field(min_length=1, max_length=4)
    quotes: list[str] = Field(min_length=1, max_length=4)
    rationale: str = Field(min_length=1, max_length=1000)


class ModelDimension(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "if": {
                "properties": {"status": {"const": "scored"}},
                "required": ["status"],
            },
            "then": {
                "properties": {
                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                    "evidence": {"minItems": 1},
                    "improvement": {"type": "string", "minLength": 1},
                },
                "required": ["score", "evidence", "improvement"],
            },
            "else": {
                "properties": {"score": {"type": "null"}},
                "required": ["score"],
            },
        },
    )

    name: DimensionName
    status: DimensionStatus
    score: int | None = Field(default=None, ge=0, le=100)
    summary: str = Field(min_length=1, max_length=1000)
    evidence: list[Evidence] = Field(default_factory=list, max_length=6)
    improvement: str | None = Field(default=None, max_length=1000)
    confidence: Confidence


class MajorIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    severity: IssueSeverity
    dimension: DimensionName
    title: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=1000)
    evidence_turn_ids: list[str] = Field(min_length=1, max_length=4)


class ModelAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confidence: Confidence
    risk_level: RiskLevel
    risk_flags: list[str] = Field(default_factory=list, max_length=10)
    dimensions: list[ModelDimension]
    major_issues: list[MajorIssue]
    suggested_reply: str | None = Field(default=None, max_length=2000)
    limitations: list[str] = Field(default_factory=list, max_length=10)


class AnalysisReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    qa_type: QAType
    analysis_status: AnalysisStatus
    total_score: int | None = Field(default=None, ge=0, le=100)
    scored_dimension_count: int = Field(ge=0, le=6)
    confidence: Confidence
    risk_level: RiskLevel
    risk_flags: list[str]
    dimensions: list[ModelDimension]
    major_issues: list[MajorIssue]
    suggested_reply: str | None
    limitations: list[str]


class AnalysisResponse(AnalysisReport):
    analysis_id: str
    remaining_uses: int = Field(ge=0)
    rubric_version: str
    prompt_version: str
    model_version: str
