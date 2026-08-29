from dataclasses import asdict

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from backend.services.auth import AuthService
from backend.services.projects import ProjectService


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


def build_projects_router(projects: ProjectService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

    @router.post("")
    def create_project(
        payload: ProjectCreateRequest,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return asdict(projects.create(user.id, payload.name))

    @router.get("")
    def list_projects(authorization: str | None = Header(default=None)) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return {"items": [asdict(item) for item in projects.list(user.id)]}

    @router.get("/{project_id}")
    def get_project(
        project_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return asdict(projects.get(user.id, project_id))

    return router

