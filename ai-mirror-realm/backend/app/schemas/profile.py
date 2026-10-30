from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SelfieUrl = Annotated[str, Field(min_length=1, max_length=500)]


class ProfileName(BaseModel):
    name: str = Field(..., min_length=1, max_length=30)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class ProfileCreate(ProfileName):
    selfie_url: SelfieUrl | None = None
    selfie_urls: list[SelfieUrl] | None = Field(None, min_length=1, max_length=9)

    @field_validator("selfie_url", mode="before")
    @classmethod
    def strip_selfie_url(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("selfie_urls", mode="before")
    @classmethod
    def strip_selfie_urls(cls, value):
        return [item.strip() if isinstance(item, str) else item for item in value] if isinstance(value, list) else value

    @model_validator(mode="after")
    def require_photos(self):
        if not self.selfie_urls and not self.selfie_url:
            raise ValueError("请上传自拍照片")
        if self.selfie_urls and self.selfie_url and self.selfie_urls[0] != self.selfie_url:
            raise ValueError("主自拍必须与照片组的第一张一致")
        self.selfie_urls = self.selfie_urls or [self.selfie_url]
        if len(self.selfie_urls) != len(set(self.selfie_urls)):
            raise ValueError("照片组不能包含重复自拍")
        self.selfie_url = self.selfie_urls[0]
        return self


class ProfileUpdate(ProfileName):
    pass


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    selfie_url: str
    selfie_urls: list[str] = Field(default_factory=list)
    created_at: datetime

    @field_validator("selfie_urls", mode="before")
    @classmethod
    def accept_legacy_null(cls, value):
        return value or []

    @model_validator(mode="after")
    def legacy_photo_group(self):
        self.selfie_urls = self.selfie_urls or [self.selfie_url]
        return self
