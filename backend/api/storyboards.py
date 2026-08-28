from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from backend.services.auth import AuthService
from backend.services.storyboards import StoryboardService


class StoryboardCreateRequest(BaseModel):
    creative_brief: str = Field(default="", max_length=2_000)


def build_storyboards_router(service: StoryboardService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["storyboards"])

    @router.post("/{project_id}/storyboards", status_code=201)
    def create_storyboard(
        project_id: str,
        payload: StoryboardCreateRequest,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        result = service.create(
            user.id,
            project_id,
            creative_brief=payload.creative_brief.strip(),
        )
        return result.model_dump()

    @router.post("/{project_id}/storyboards/{storyboard_id}/confirm")
    def confirm_storyboard(
        project_id: str,
        storyboard_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.confirm(user.id, project_id, storyboard_id)

    return router
