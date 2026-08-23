from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.api.dependencies import AuthorizedAccess, get_runtime, require_writable_access
from app.schemas.feedback import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/analyses", tags=["feedback"])


@router.put("/{analysis_id}/feedback", response_model=FeedbackResponse)
def put_feedback(
    analysis_id: str,
    payload: FeedbackRequest,
    request: Request,
    access: Annotated[AuthorizedAccess, Depends(require_writable_access)],
) -> FeedbackResponse:
    runtime = get_runtime(request)
    return runtime.feedback_service.upsert(
        access.context.invite_id,
        analysis_id,
        helpful=payload.helpful,
        reason_code=payload.reason_code,
    )
