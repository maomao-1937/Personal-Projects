"""Pydantic I/O。所有 API 请求/响应都校验。"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ===== 请求 =====

class AcceptanceRequest(BaseModel):
    prd_text: str = Field(..., min_length=10, description="PRD 全文")
    target_url: str = Field(..., description="待验收产品网址")
    allow_destructive: bool = Field(
        False, description="是否允许破坏性操作,默认只读"
    )


class ReviewRequest(BaseModel):
    prd_text: str = Field(..., min_length=10, description="PRD 全文")


# ===== 响应 =====

class JobCreatedResponse(BaseModel):
    job_id: str
    status: str


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    kind: str
    path: Optional[str] = None
    content: Optional[str] = None
    created_at: datetime


class ChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    seq: int
    description: str
    expected: str
    destructive: bool
    status: str
    judge_result: Optional[str] = None
    judge_reason: Optional[str] = None
    evidence: list[EvidenceOut] = []


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    item_id: Optional[str] = None
    severity: str
    category: str
    message: str
    suggestion: str


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    type: str
    target_url: Optional[str] = None
    allow_destructive: bool = False
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    result_json: Optional[dict] = None
    checklist_items: list[ChecklistItemOut] = []
    findings: list[FindingOut] = []


class JobListResponse(BaseModel):
    total: int
    jobs: list[JobOut]


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    mock_mode: bool
