from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.api.dependencies import (
    ACCESS_COOKIE_NAME,
    AuthorizedAccess,
    get_runtime,
    require_access,
    require_csrf,
)
from app.schemas.access import (
    AccessResponse,
    AccessStatusResponse,
    LeaveAccessResponse,
    RedeemInviteRequest,
)

router = APIRouter(prefix="/access", tags=["access"])


@router.post("/redeem", response_model=AccessResponse)
def redeem_invite(
    payload: RedeemInviteRequest,
    request: Request,
    response: Response,
) -> AccessResponse:
    runtime = get_runtime(request)
    access = runtime.invite_service.redeem(payload.code)
    access_token, csrf_token = runtime.security.issue_access(access.invite_id)
    context = runtime.security.read_access(access_token)
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=runtime.settings.access_ttl_seconds,
        httponly=True,
        secure=runtime.settings.is_production,
        samesite="lax",
        path="/",
    )
    return AccessResponse(
        remaining_uses=access.remaining_uses,
        expires_at=context.expires_at,
        csrf_token=csrf_token,
    )


@router.get("/status", response_model=AccessStatusResponse)
def access_status(
    access: Annotated[AuthorizedAccess, Depends(require_access)],
) -> AccessStatusResponse:
    return AccessStatusResponse(
        authenticated=True,
        remaining_uses=access.remaining_uses,
        expires_at=access.context.expires_at,
        csrf_token=access.context.csrf_token,
    )


@router.delete("", response_model=LeaveAccessResponse)
def leave_access(
    response: Response,
    _access: Annotated[AuthorizedAccess, Depends(require_csrf)],
) -> LeaveAccessResponse:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    return LeaveAccessResponse(cleared=True)
