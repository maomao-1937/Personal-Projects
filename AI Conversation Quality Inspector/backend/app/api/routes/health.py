from fastapi import APIRouter, Request, Response
from sqlalchemy import text

from app.api.dependencies import get_runtime
from app.schemas.common import HealthResponse, ReadyResponse

router = APIRouter(tags=["health"])


@router.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/health/ready", response_model=ReadyResponse)
def ready(request: Request, response: Response) -> ReadyResponse:
    runtime = get_runtime(request)
    database_ready = False
    try:
        with runtime.session_factory() as session:
            session.execute(text("SELECT 1"))
        database_ready = True
    except Exception:
        database_ready = False
    backup_ready = runtime.backup_service is None or runtime.backup_service.is_healthy(
        max_age_seconds=runtime.settings.sqlite_backup_max_age_seconds
    )
    is_ready = database_ready and backup_ready
    if not is_ready:
        response.status_code = 503
    return ReadyResponse(
        status="ready" if is_ready else "degraded",
        database_ready=database_ready,
        backup_ready=backup_ready,
        llm_configured=runtime.settings.llm_is_configured,
    )
