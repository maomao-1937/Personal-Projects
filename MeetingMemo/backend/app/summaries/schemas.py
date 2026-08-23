from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Confidence = Literal["high", "medium", "low"]


class PromptSegment(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    sequence: int
    speaker: str | None = None
    start_ms: int | None = None
    end_ms: int | None = None
    text: str


class Topic(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    summary: str = Field(min_length=1)
    source_segment_ids: list[str] = Field(min_length=1)


class Decision(BaseModel):
    text: str = Field(min_length=1)
    source_segment_ids: list[str] = Field(min_length=1)
    confidence: Confidence


class ActionItem(BaseModel):
    task: str = Field(min_length=1)
    owner: str | None = None
    due_date: str | None = None
    source_segment_ids: list[str] = Field(min_length=1)
    confidence: Confidence


class OpenQuestion(BaseModel):
    text: str = Field(min_length=1)
    source_segment_ids: list[str] = Field(min_length=1)


class SummaryPayload(BaseModel):
    summary_version: Literal["1.0"] = "1.0"
    headline: str = Field(min_length=1)
    topics: list[Topic]
    decisions: list[Decision]
    action_items: list[ActionItem]
    open_questions: list[OpenQuestion]
    quality_flags: list[str]


class SummaryRevisionRequest(BaseModel):
    expected_version: int = Field(ge=1)
    content: SummaryPayload


class SummaryVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    meeting_id: str
    version: int
    schema_version: str
    content: SummaryPayload
    quality_flags: list[str]
    status: str
    parent_version_id: str | None
    created_source: str
    created_at: datetime


class SummaryListResponse(BaseModel):
    items: list[SummaryVersionResponse]
