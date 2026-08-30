from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PortraitCreate(BaseModel):
    style_id: str = Field(..., min_length=1, max_length=100, description="风格ID")
    selfie_url: str = Field(..., min_length=1, max_length=500, description="自拍照URL")

    @field_validator("style_id", "selfie_url")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("该字段不能为空")
        return v.strip()


class PortraitOut(BaseModel):
    id: str
    style_id: str
    selfie_url: str
    result_url: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    credits_used: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PortraitStatus(BaseModel):
    id: str
    status: str
    result_url: Optional[str] = None
    error_message: Optional[str] = None
