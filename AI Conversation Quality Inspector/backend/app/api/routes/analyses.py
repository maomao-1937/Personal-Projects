from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.api.dependencies import AuthorizedAccess, get_runtime, require_writable_access
from app.schemas.analysis import AnalysisRequest, AnalysisResponse

router = APIRouter(prefix="/analyses", tags=["analyses"])


@router.post("", response_model=AnalysisResponse)
def create_analysis(
    payload: AnalysisRequest,
    request: Request,
    access: Annotated[AuthorizedAccess, Depends(require_writable_access)],
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> AnalysisResponse:
    runtime = get_runtime(request)
    return runtime.analysis_service.analyze(
        access.context.invite_id,
        str(idempotency_key),
        payload,
    )
