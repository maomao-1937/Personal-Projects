from fastapi import APIRouter, Header

from backend.domain.errors import DomainError
from backend.services.auth import AuthService
from backend.services.rendering import RenderingService


def build_previews_router(service: RenderingService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["previews"])

    @router.post("/{project_id}/previews", status_code=202)
    def create_preview(
        project_id: str,
        authorization: str | None = Header(default=None),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        if not idempotency_key:
            raise DomainError("idempotency_key_required", "缺少 Idempotency-Key。", status_code=422)
        user = auth.authenticate_bearer(authorization)
        return service.create_preview(
            user.id,
            project_id,
            idempotency_key=idempotency_key,
        ).model_dump()

    return router
