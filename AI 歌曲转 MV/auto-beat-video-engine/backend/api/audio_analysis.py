from dataclasses import asdict

from fastapi import APIRouter, Header, Query

from backend.domain.errors import DomainError
from backend.services.audio_analysis import AudioAnalysisService
from backend.services.auth import AuthService


def build_audio_analysis_router(service: AudioAnalysisService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["audio"])

    @router.post("/{project_id}/audio/analysis", status_code=202)
    def create_analysis(
        project_id: str,
        sensitivity: int = Query(default=50, ge=0, le=100),
        authorization: str | None = Header(default=None),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        if not idempotency_key:
            raise DomainError("idempotency_key_required", "缺少 Idempotency-Key。", status_code=422)
        user = auth.authenticate_bearer(authorization)
        return asdict(
            service.create(
                user.id,
                project_id,
                idempotency_key=idempotency_key,
                sensitivity=sensitivity,
            )
        )

    @router.get("/{project_id}/audio/analysis")
    def get_analysis(
        project_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.get_current(user.id, project_id).model_dump()

    return router
