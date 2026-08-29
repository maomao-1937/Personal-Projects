from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.domain.errors import DomainError
from backend.services.auth import AuthService
from backend.services.rendering import RenderingService


class ExportCreateRequest(BaseModel):
    aspect_ratio: str


def build_exports_router(service: RenderingService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["exports"])

    @router.post("/{project_id}/exports", status_code=202)
    def create_export(
        project_id: str,
        payload: ExportCreateRequest,
        authorization: str | None = Header(default=None),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        if not idempotency_key:
            raise DomainError("idempotency_key_required", "缺少 Idempotency-Key。", status_code=422)
        user = auth.authenticate_bearer(authorization)
        return service.create_export(
            user.id,
            project_id,
            aspect_ratio=payload.aspect_ratio,
            idempotency_key=idempotency_key,
        ).model_dump()

    @router.get("/{project_id}/exports/{aspect_ratio}")
    def export_status(
        project_id: str,
        aspect_ratio: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.export_status(user.id, project_id, aspect_ratio).model_dump()

    return router
