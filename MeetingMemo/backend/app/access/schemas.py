from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class RedeemRequest(BaseModel):
    invite_code: str = Field(min_length=8, max_length=128)

    @field_validator("invite_code")
    @classmethod
    def strip_invite_code(cls, value: str) -> str:
        return value.strip()


class RedeemResponse(BaseModel):
    authenticated: bool = True
    remaining_redemptions: int
    expires_at: datetime


class AccessSessionResponse(BaseModel):
    authenticated: bool = True
    session_id: str
    expires_at: datetime
