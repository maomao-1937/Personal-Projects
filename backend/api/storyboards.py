from dataclasses import asdict

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from backend.domain.errors import DomainError
from backend.services.auth import AuthService
from backend.services.storyboards import PlotSpec, StoryboardEditCut, StoryboardService


class StoryboardCreateRequest(BaseModel):
    creative_brief: str = Field(default="", max_length=2_000)


class StoryboardRevisionRequest(BaseModel):
    plot: PlotSpec
    cuts: list[StoryboardEditCut] = Field(min_length=4, max_length=12)


def build_storyboards_router(service: StoryboardService, auth: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/projects", tags=["storyboards"])

    @router.post("/{project_id}/storyboard-jobs", status_code=202)
    def create_storyboard_job(
        project_id: str,
        payload: StoryboardCreateRequest,
        authorization: str | None = Header(default=None),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        if not idempotency_key:
            raise DomainError("idempotency_key_required", "缺少 Idempotency-Key。", status_code=422)
        user = auth.authenticate_bearer(authorization)
        return asdict(
            service.create_job(
                user.id,
                project_id,
                creative_brief=payload.creative_brief.strip(),
                idempotency_key=idempotency_key,
            )
        )

    @router.get("/{project_id}/storyboards/latest")
    def get_latest_storyboard(
        project_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.latest(user.id, project_id).model_dump()

    @router.get("/{project_id}/storyboards/{storyboard_id}")
    def get_storyboard(
        project_id: str,
        storyboard_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.get(user.id, project_id, storyboard_id).model_dump()

    @router.patch("/{project_id}/storyboards/{storyboard_id}", status_code=201)
    def revise_storyboard(
        project_id: str,
        storyboard_id: str,
        payload: StoryboardRevisionRequest,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.revise(
            user.id,
            project_id,
            storyboard_id,
            plot=payload.plot,
            cuts=payload.cuts,
        ).model_dump()

    @router.post("/{project_id}/storyboards/{storyboard_id}/confirm")
    def confirm_storyboard(
        project_id: str,
        storyboard_id: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, object]:
        user = auth.authenticate_bearer(authorization)
        return service.confirm(user.id, project_id, storyboard_id)

    return router
