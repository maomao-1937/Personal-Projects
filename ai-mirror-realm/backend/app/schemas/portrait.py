from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class PortraitCreate(BaseModel):
    style_id: Optional[str] = Field(None, min_length=1, max_length=100, description="风格ID")
    user_prompt: Optional[str] = Field(None, max_length=500, description="用户创作描述")
    selfie_url: str = Field(..., min_length=1, max_length=500, description="自拍照URL")
    selfie_urls: list[Annotated[str, Field(min_length=1, max_length=500)]] | None = Field(None, min_length=1, max_length=9)

    @field_validator("selfie_urls", mode="before")
    @classmethod
    def strip_selfie_urls(cls, value):
        return [item.strip() if isinstance(item, str) else item for item in value] if isinstance(value, list) else value

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
        if self.selfie_urls and self.selfie_urls[0] != self.selfie_url:
            raise ValueError("主自拍必须与照片组的第一张一致")
        if self.selfie_urls and len(self.selfie_urls) != len(set(self.selfie_urls)):
            raise ValueError("照片组不能包含重复自拍")
        return self


class PortraitOut(BaseModel):
    id: str
    style_id: str
    style_name: Optional[str] = None
    selfie_url: str
    selfie_urls: list[str] = Field(default_factory=list)
    profile_name: Optional[str] = None
    user_prompt: Optional[str] = None
    result_url: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    @field_validator("selfie_urls", mode="before")
    @classmethod
    def accept_legacy_null(cls, value):
        return value or []

    @model_validator(mode="after")
    def legacy_photo_group(self):
        self.selfie_urls = self.selfie_urls or [self.selfie_url]
        return self

    class Config:
        from_attributes = True


class PortraitStatus(BaseModel):
    id: str
    status: str
    result_url: Optional[str] = None
    error_message: Optional[str] = None
