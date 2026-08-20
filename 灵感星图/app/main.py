from __future__ import annotations

from pathlib import Path
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.auth import StaticTokenAuth
from app.config import get_settings
from app.domain import (
    Feedback,
    FeedbackCreate,
    IncubationRequest,
    Material,
    MaterialCreate,
    MaterialUpdate,
    ProjectHypothesis,
)
from app.ingestion import IngestionService
from app.model_gateway import (
    AnthropicModelGateway,
    HeuristicModelGateway,
    ModelGateway,
    ModelGatewayAuthenticationError,
    ModelGatewayInvalidResponse,
    ModelGatewayUnavailable,
    TencentHy3ModelGateway,
)
from app.repository import Repository
from app.retrieval import MaterialRetriever
from app.security import UnsafeUrlError
from app.workflow import (
    IncubationWorkflow,
    InvalidModelOutput,
    SeedMaterialNotFound,
    SeedMaterialNotReady,
)

STATIC_DIR = Path(__file__).with_name("static")


def _default_gateway() -> ModelGateway:
    settings = get_settings()
    if settings.tencent_hy3_api_key:
        return TencentHy3ModelGateway(api_key=settings.tencent_hy3_api_key)
    if settings.anthropic_api_key:
        return AnthropicModelGateway(
            api_key=settings.anthropic_api_key,
            model_name=settings.model_id,
        )
    return HeuristicModelGateway()


def create_app(
    *,
    database_url: str | None = None,
    model_gateway: ModelGateway | None = None,
    api_token: str | None = None,
) -> FastAPI:
    settings = get_settings()
    repository = Repository(database_url or settings.database_url)
    repository.create_schema()
    gateway = model_gateway or _default_gateway()
    auth = StaticTokenAuth(settings.app_api_token if api_token is None else api_token)

    application = FastAPI(title=settings.app_name, version="0.1.0")
    application.state.repository = repository
    application.state.model_gateway = gateway
    application.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")

    def current_user(authorization: str | None = Header(default=None)) -> str:
        return auth.authenticate(authorization)

    def raise_model_error(exc: Exception) -> None:
        if isinstance(exc, ModelGatewayAuthenticationError):
            raise HTTPException(
                status_code=503, detail="内置 AI 暂时不可用，请稍后重试"
            ) from exc
        if isinstance(exc, ModelGatewayInvalidResponse):
            raise HTTPException(
                status_code=502, detail="内置 AI 返回结果异常，请重试"
            ) from exc
        raise HTTPException(
            status_code=503, detail="内置 AI 暂时不可用，请稍后重试"
        ) from exc

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/", include_in_schema=False)
    def web_app() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @application.post("/materials", response_model=Material, status_code=201)
    def create_material(
        data: MaterialCreate,
        user_id: str = Depends(current_user),
    ) -> Material:
        try:
            return IngestionService(repository, gateway).ingest(user_id, data)
        except (
            ModelGatewayAuthenticationError,
            ModelGatewayInvalidResponse,
            ModelGatewayUnavailable,
        ) as exc:
            raise_model_error(exc)
        except UnsafeUrlError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="unable to fetch URL") from exc

    @application.get("/materials", response_model=list[Material])
    def list_materials(user_id: str = Depends(current_user)) -> list[Material]:
        return repository.list_materials(user_id)

    @application.get("/materials/{material_id}", response_model=Material)
    def get_material(
        material_id: UUID, user_id: str = Depends(current_user)
    ) -> Material:
        material = repository.get_material(user_id, material_id)
        if material is None:
            raise HTTPException(status_code=404, detail="material not found")
        return material

    @application.patch("/materials/{material_id}", response_model=Material)
    @application.post("/materials/{material_id}/update", response_model=Material)
    def update_material(
        material_id: UUID,
        data: MaterialUpdate,
        user_id: str = Depends(current_user),
    ) -> Material:
        try:
            material = IngestionService(repository, gateway).update(
                user_id, material_id, data
            )
        except (
            ModelGatewayAuthenticationError,
            ModelGatewayInvalidResponse,
            ModelGatewayUnavailable,
        ) as exc:
            raise_model_error(exc)
        if material is None:
            raise HTTPException(status_code=404, detail="material not found")
        return material

    @application.post("/materials/{material_id}/reanalyze", response_model=Material)
    def reanalyze_material(
        material_id: UUID,
        user_id: str = Depends(current_user),
    ) -> Material:
        try:
            material = IngestionService(repository, gateway).reanalyze(
                user_id, material_id
            )
        except (
            ModelGatewayAuthenticationError,
            ModelGatewayInvalidResponse,
            ModelGatewayUnavailable,
        ) as exc:
            raise_model_error(exc)
        if material is None:
            raise HTTPException(status_code=404, detail="material not found")
        return material

    @application.post(
        "/incubations",
        response_model=ProjectHypothesis,
        status_code=201,
    )
    def create_incubation(
        data: IncubationRequest,
        user_id: str = Depends(current_user),
    ) -> ProjectHypothesis:
        try:
            return IncubationWorkflow(
                repository,
                MaterialRetriever(repository),
                gateway,
                retrieval_limit=settings.retrieval_limit,
            ).run(user_id, data)
        except (
            ModelGatewayAuthenticationError,
            ModelGatewayInvalidResponse,
            ModelGatewayUnavailable,
        ) as exc:
            raise_model_error(exc)
        except SeedMaterialNotFound as exc:
            raise HTTPException(
                status_code=404, detail="核心素材不存在，请重新选择"
            ) from exc
        except SeedMaterialNotReady as exc:
            raise HTTPException(
                status_code=400, detail="核心素材尚未分析完成，请重新选择"
            ) from exc
        except InvalidModelOutput as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @application.get(
        "/hypotheses",
        response_model=list[ProjectHypothesis],
    )
    def list_hypotheses(
        user_id: str = Depends(current_user),
    ) -> list[ProjectHypothesis]:
        return repository.list_hypotheses(user_id)

    @application.post(
        "/hypotheses/{hypothesis_id}/feedback",
        response_model=Feedback,
        status_code=201,
    )
    def create_feedback(
        hypothesis_id: UUID,
        data: FeedbackCreate,
        user_id: str = Depends(current_user),
    ) -> Feedback:
        feedback = repository.add_feedback(user_id, hypothesis_id, data)
        if feedback is None:
            raise HTTPException(status_code=404, detail="hypothesis not found")
        return feedback

    return application


app = create_app()
