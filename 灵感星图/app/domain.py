from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

MaterialSourceType = Literal["text", "url"]
HypothesisStatus = Literal["ready", "no_viable_direction"]
FeedbackCategory = Literal[
    "worth_doing",
    "too_generic",
    "weak_connection",
    "too_large",
    "not_interested",
]


class DomainModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class MaterialCreate(DomainModel):
    source_type: MaterialSourceType
    title: str | None = Field(default=None, max_length=300)
    content: str | None = Field(default=None, max_length=200_000)
    source_url: AnyHttpUrl | None = None

    @field_validator("title", "content")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_source_fields(self) -> MaterialCreate:
        if self.source_type == "text" and not self.content:
            raise ValueError("content is required for text material")
        if self.source_type == "url" and self.source_url is None:
            raise ValueError("source_url is required for url material")
        return self


class MaterialUpdate(DomainModel):
    title: str | None = Field(default=None, max_length=300)
    content: str = Field(min_length=1, max_length=200_000)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("content must not be blank")
        return stripped


class MaterialAnalysis(DomainModel):
    summary: str = Field(min_length=1, max_length=1_000)
    organized_text: str = Field(
        min_length=1,
        max_length=4_000,
        description=(
            "A clearer, concise rewrite of the supplied idea. Preserve its meaning and "
            "do not add unsupported facts, evidence, or conclusions."
        ),
    )
    material_type: str = Field(min_length=1, max_length=80)
    actors: list[str] = Field(default_factory=list)
    problems: list[str] = Field(default_factory=list)
    mechanisms: list[str] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)


class Material(DomainModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: str = Field(min_length=1, max_length=128)
    source_type: MaterialSourceType
    title: str | None = None
    raw_text: str = ""
    source_url: str | None = None
    summary: str = ""
    organized_text: str | None = None
    material_type: str = "unclassified"
    actors: list[str] = Field(default_factory=list)
    problems: list[str] = Field(default_factory=list)
    mechanisms: list[str] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    processing_status: Literal["processing", "ready", "failed"] = "processing"
    model_name: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class IncubationConstraints(DomainModel):
    available_days: int = Field(default=2, ge=1, le=30)
    budget: str = Field(default="low", max_length=100)
    skills: list[str] = Field(default_factory=list)
    excluded_topics: list[str] = Field(default_factory=list)


class IncubationRequest(DomainModel):
    seed_material_id: UUID
    query: str = Field(default="给我一个周末项目", min_length=1, max_length=500)
    constraints: IncubationConstraints = Field(default_factory=IncubationConstraints)


class SourceContribution(DomainModel):
    material_id: UUID
    role: Literal["problem", "mechanism", "insight", "constraint"]
    contribution: str = Field(min_length=1, max_length=1_000)


class ProjectHypothesis(DomainModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: str | None = None
    status: HypothesisStatus
    query: str | None = Field(default=None, max_length=500)
    title: str | None = None
    one_liner: str | None = None
    target_user: str | None = None
    problem: str | None = None
    source_contributions: list[SourceContribution] = Field(default_factory=list)
    relationship_explanation: str | None = None
    mvp_scope: list[str] = Field(default_factory=list)
    non_goals: list[str] = Field(default_factory=list)
    first_validation_action: str | None = None
    time_estimate: str | None = None
    risks: list[str] = Field(default_factory=list)
    reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @model_validator(mode="after")
    def validate_status_payload(self) -> ProjectHypothesis:
        if self.status == "no_viable_direction":
            if not self.reason or not self.reason.strip():
                raise ValueError("reason is required for no_viable_direction")
            if self.source_contributions:
                raise ValueError(
                    "no_viable_direction must not include source contributions"
                )
            return self

        required = {
            "title": self.title,
            "one_liner": self.one_liner,
            "target_user": self.target_user,
            "problem": self.problem,
            "relationship_explanation": self.relationship_explanation,
            "first_validation_action": self.first_validation_action,
            "time_estimate": self.time_estimate,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(
                f"ready hypothesis has blank or missing fields: {', '.join(missing)}"
            )
        unique_sources = {item.material_id for item in self.source_contributions}
        if len(unique_sources) < 2:
            raise ValueError(
                "ready hypothesis requires at least 2 source contributions"
            )
        if not self.mvp_scope or any(not item for item in self.mvp_scope):
            raise ValueError("ready hypothesis requires non-blank mvp_scope items")
        for field_name, values in (
            ("non_goals", self.non_goals),
            ("risks", self.risks),
        ):
            if any(not item for item in values):
                raise ValueError(f"{field_name} must not contain blank items")
        return self


class FeedbackCreate(DomainModel):
    category: FeedbackCategory
    note: str | None = Field(default=None, max_length=2_000)


class Feedback(DomainModel):
    id: UUID = Field(default_factory=uuid4)
    user_id: str
    hypothesis_id: UUID
    category: FeedbackCategory
    note: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
