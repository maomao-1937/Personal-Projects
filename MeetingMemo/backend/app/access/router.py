from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.access.dependencies import get_access_service, require_access_session
from app.access.models import AccessSession
from app.access.schemas import AccessSessionResponse, RedeemRequest, RedeemResponse
from app.access.service import AccessService
from app.core.security import SESSION_COOKIE_NAME

router = APIRouter(prefix="/api/v1/access", tags=["access"])


@router.post("/redeem", response_model=RedeemResponse)
def redeem_invite(
    payload: RedeemRequest,
    response: Response,
    request: Request,
    service: Annotated[AccessService, Depends(get_access_service)],
) -> RedeemResponse:
    redeemed = service.redeem(
        payload.invite_code,
        client_ip=request.client.host if request.client else "unknown",
        trace_id=request.state.trace_id,
    )
    settings = request.app.state.settings
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=redeemed.token,
        max_age=settings.session_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )
    return RedeemResponse(
        remaining_redemptions=redeemed.remaining_redemptions,
        expires_at=redeemed.expires_at,
    )


@router.get("/session", response_model=AccessSessionResponse)
def read_session(
    access_session: Annotated[AccessSession, Depends(require_access_session)],
) -> AccessSessionResponse:
    return AccessSessionResponse(
        session_id=access_session.id,
        expires_at=access_session.expires_at,
    )


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    service: Annotated[AccessService, Depends(get_access_service)],
) -> None:
    service.revoke(request.cookies.get(SESSION_COOKIE_NAME))
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
