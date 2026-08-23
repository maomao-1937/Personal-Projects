from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RedeemInviteRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=16, max_length=256)

    @field_validator("code")
    @classmethod
    def reject_blank_code(cls, value: str) -> str:
        if not value:
            raise ValueError("邀请码不能为空")
        return value


class AccessResponse(BaseModel):
    remaining_uses: int = Field(ge=0)
    expires_at: datetime
    csrf_token: str


class AccessStatusResponse(AccessResponse):
    authenticated: bool = True


class LeaveAccessResponse(BaseModel):
    cleared: bool = True
