from fastapi import APIRouter, Request

from app.api.dependencies import get_runtime
from app.schemas.common import PublicConfigResponse

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/config", response_model=PublicConfigResponse)
def public_config(request: Request) -> PublicConfigResponse:
    settings = get_runtime(request).settings
    return PublicConfigResponse(
        min_transcript_chars=settings.min_transcript_chars,
        max_transcript_chars=settings.max_transcript_chars,
        max_turns=settings.max_turns,
        invite_usage_limit=settings.invite_usage_limit,
        rubric_version=settings.rubric_version,
    )
