from dataclasses import asdict

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.auth import AuthService


class InviteLoginRequest(BaseModel):
    invite_code: str = Field(min_length=1, max_length=256)


def build_auth_router(auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

    @router.post("/invite")
    def login(payload: InviteLoginRequest) -> dict[str, object]:
        user, token = auth.login(payload.invite_code)
        return {"user": asdict(user), "session_token": token, "token_type": "Bearer"}

    return router

