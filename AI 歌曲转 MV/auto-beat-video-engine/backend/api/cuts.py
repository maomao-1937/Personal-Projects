from dataclasses import asdict

from fastapi import APIRouter, Header

from backend.domain.errors import DomainError
from backend.services.auth import AuthService
from backend.services.cuts import CutService


def build_cuts_router(service: CutService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["cuts"])

    def require_key(value: str | None) -> str:
        if not value:
            raise DomainError("idempotency_key_required", "缺少 Idempotency-Key。", status_code=422)
        return value

    @router.get("/{project_id}/storyboards/{storyboard_id}/cuts/status")
    def aggregate(
        project_id: str,
        storyboard_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.aggregate(user.id, project_id, storyboard_id).model_dump()

    @router.post("/{project_id}/storyboards/{storyboard_id}/cuts/generate-all", status_code=202)
    def generate_all(
        project_id: str,
        storyboard_id: str,
        authorization: str | None = Header(default=None),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        jobs = service.generate_all(
            user.id,
            project_id,
            storyboard_id,
            idempotency_key=require_key(idempotency_key),
        )
        return {"jobs": [asdict(job) for job in jobs]}

    def queue_one(project_id, cut_id, authorization, idempotency_key, action):
        user = auth.authenticate_bearer(authorization)
        job = action(
            user.id,
            project_id,
            cut_id,
            idempotency_key=require_key(idempotency_key),
        )
        return asdict(job)

    @router.post("/{project_id}/cuts/{cut_id}/generate", status_code=202)
    def generate(project_id: str, cut_id: str, authorization: str | None = Header(default=None), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
        return queue_one(project_id, cut_id, authorization, idempotency_key, service.generate)

    @router.post("/{project_id}/cuts/{cut_id}/retry", status_code=202)
    def retry(project_id: str, cut_id: str, authorization: str | None = Header(default=None), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
        return queue_one(project_id, cut_id, authorization, idempotency_key, service.retry)

    @router.post("/{project_id}/cuts/{cut_id}/regenerate", status_code=202)
    def regenerate(project_id: str, cut_id: str, authorization: str | None = Header(default=None), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
        return queue_one(project_id, cut_id, authorization, idempotency_key, service.regenerate)

    return router
