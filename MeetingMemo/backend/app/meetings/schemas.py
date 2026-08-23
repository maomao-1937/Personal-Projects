from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

FeedbackErrorType = Literal[
    "fact_error",
    "missing_decision",
    "missing_action",
    "wrong_owner",
    "wrong_due_date",
    "other",
]


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    meeting_at: datetime | None = None
    timezone: str = Field(default="Asia/Shanghai", min_length=1, max_length=80)
    language: str = Field(default="zh-CN", min_length=2, max_length=16)

    @field_validator("title", "timezone", "language")
    @classmethod
    def strip_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized


class TranscriptTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500_000)


class TranscriptSegmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sequence: int
    start_ms: int | None
    end_ms: int | None
    speaker: str | None
    text: str


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    meeting_at: datetime | None
    timezone: str
    source: str
    language: str
    status: str
    created_at: datetime
    updated_at: datetime


class MeetingDetailResponse(MeetingResponse):
    segments: list[TranscriptSegmentResponse]


class MeetingListResponse(BaseModel):
    items: list[MeetingResponse]


class TranscriptUpdateResponse(BaseModel):
    meeting_id: str
    segment_count: int


class FeedbackCreate(BaseModel):
    meeting_id: str | None = None
    summary_version_id: str | None = None
    rating: int = Field(ge=1, le=5)
    error_types: list[FeedbackErrorType] = Field(default_factory=list, max_length=8)
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    meeting_id: str | None
    summary_version_id: str | None
    rating: int
    error_types: list[FeedbackErrorType]
    comment: str | None
    created_at: datetime
