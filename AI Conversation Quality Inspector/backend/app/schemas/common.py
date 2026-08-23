from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class ReadyResponse(HealthResponse):
    database_ready: bool
    backup_ready: bool
    llm_configured: bool


class PublicConfigResponse(BaseModel):
    min_transcript_chars: int
    max_transcript_chars: int
    max_turns: int
    invite_usage_limit: int
    rubric_version: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str
    retryable: bool = False
    field_errors: list[dict[str, Any]] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorDetail
