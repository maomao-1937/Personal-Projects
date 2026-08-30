import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator, EmailStr


# 用户名/昵称正则：只允许字母数字下划线，长度 3-20
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,20}$")


class UserRegister(BaseModel):
    phone: Optional[str] = Field(None, description="手机号", max_length=20)
    email: Optional[EmailStr] = Field(None, description="邮箱")
    password: str = Field(..., min_length=6, max_length=128, description="密码（最少6位）")
    nickname: Optional[str] = Field(None, max_length=20, description="昵称（3-20位字母数字下划线）")

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not USERNAME_PATTERN.match(v):
            raise ValueError("昵称只能包含字母、数字和下划线，长度为3-20位")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # 简单校验：只允许数字和 + 号，长度 7-20
        if not re.match(r"^\+?\d{7,20}$", v):
            raise ValueError("手机号格式不正确")
        return v

    @model_validator(mode="after")
    def at_least_one_contact(self) -> "UserRegister":
        """确保手机号和邮箱至少填写一个"""
        if not self.phone and not self.email:
            raise ValueError("手机号和邮箱至少填写一个")
        return self


class UserLogin(BaseModel):
    account: str = Field(..., description="手机号或邮箱", min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=128, description="密码")


class UserOut(BaseModel):
    id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    nickname: str
    avatar_url: Optional[str] = None
    credits: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
