from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class PortraitCreate(BaseModel):
    style_id: Optional[str] = Field(None, min_length=1, max_length=100, description="风格ID")
    user_prompt: Optional[str] = Field(None, max_length=500, description="用户创作描述")
    selfie_url: str = Field(..., min_length=1, max_length=500, description="自拍照URL")

    @field_validator("style_id", "user_prompt")
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        value = v.strip()
        return value or None

    @field_validator("selfie_url")
    @classmethod
    def selfie_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("该字段不能为空")
        return v.strip()

    @model_validator(mode="after")
    def require_creation_direction(self):
        if not self.style_id and not self.user_prompt:
            raise ValueError("请输入写真描述或选择一个主题")
        return self


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
