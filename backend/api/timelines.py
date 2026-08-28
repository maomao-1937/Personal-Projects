from fastapi import APIRouter, Header

from backend.services.auth import AuthService
from backend.services.timelines import TimelineService


def build_timelines_router(service: TimelineService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["timelines"])

    @router.get("/{project_id}/timeline")
    def get_current_timeline(
        project_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.build_current(user.id, project_id).model_dump()

    return router
