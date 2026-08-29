from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import create_v1_router
from app.core.config import Settings, get_settings
from app.core.database import Database
from app.core.migrations import run_migrations
from app.llm.provider import LLMProvider, OpenAICompatibleProvider
from app.repositories.cases import CaseRepository
from app.repositories.sessions import SessionRepository
from app.services.case_generation import CaseGenerationError, CaseGenerationService
from app.services.case_catalog import CaseCatalog
from app.services.game import GameError, GameService
from app.services.responder import SuspectResponder
from app.services.auth import AccessAuthService, AuthError
from app.services.database_backup import DatabaseBackupError, DatabaseBackupService


logger = logging.getLogger(__name__)


def create_app(
    database_url: str | None = None,
    *,
    migrate_on_startup: bool = True,
    llm_provider: LLMProvider | None = None,
    auth_service: AccessAuthService | None = None,
    settings: Settings | None = None,
    database_backup_service: DatabaseBackupService | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    resolved_database_url = database_url or resolved_settings.database_url
    database = Database(resolved_database_url)
    resolved_provider = llm_provider or OpenAICompatibleProvider.from_settings(
        resolved_settings
    )
    resolved_auth_service = auth_service or AccessAuthService.from_settings(
        resolved_settings
    )
    resolved_backup_service = (
        database_backup_service
        or DatabaseBackupService.from_settings(
            resolved_settings,
            database_url=resolved_database_url,
        )
    )
    case_repository = CaseRepository(database)
    service = GameService(
        SessionRepository(database),
        CaseCatalog(case_repository),
        SuspectResponder(resolved_provider),
    )
    case_generation_service = CaseGenerationService(
        case_repository,
        resolved_provider,
        # Runtime generation is intentionally one model call with internal
        # self-checking; retries belong in a pre-generated content pipeline.
        max_attempts=1,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        _validate_production_configuration(
            resolved_settings,
            resolved_auth_service,
            resolved_provider,
            resolved_backup_service,
        )
        if resolved_backup_service.configured:
            await asyncio.to_thread(resolved_backup_service.restore_if_missing)
        if migrate_on_startup:
            run_migrations(resolved_database_url)
        stop_backup = asyncio.Event()
        backup_task = (
            asyncio.create_task(
                _run_periodic_backup(resolved_backup_service, stop_backup)
            )
            if resolved_backup_service.configured
            else None
        )
        try:
            yield
        finally:
            if backup_task is not None:
                stop_backup.set()
                await backup_task
                try:
                    await asyncio.to_thread(resolved_backup_service.backup_now)
                except DatabaseBackupError:
                    logger.exception("final database backup failed")

    application = FastAPI(
        title="AI 审讯室 API",
        docs_url=None if resolved_settings.app_env == "production" else "/docs",
        openapi_url=(
            None if resolved_settings.app_env == "production" else "/openapi.json"
        ),
        redoc_url=None,
        lifespan=lifespan,
    )
    application.state.database = database
    application.state.game_service = service
    application.state.auth_service = resolved_auth_service
    application.state.database_backup_service = resolved_backup_service
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    @application.exception_handler(GameError)
    async def game_error_handler(_: Request, exc: GameError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.user_message}},
        )

    @application.exception_handler(AuthError)
    async def auth_error_handler(_: Request, exc: AuthError) -> JSONResponse:
        headers = {"Retry-After": "900"} if exc.status_code == 429 else None
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.user_message}},
            headers=headers,
        )

    @application.exception_handler(CaseGenerationError)
    async def case_generation_error_handler(
        _: Request, exc: CaseGenerationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.user_message}},
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _: Request, __: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "请检查输入内容后再试。",
                }
            },
        )

    application.include_router(
        create_v1_router(
            service,
            case_generation_service,
            resolved_auth_service,
            resolved_settings,
        )
    )
    return application


app = create_app()


async def _run_periodic_backup(
    service: DatabaseBackupService,
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=service.interval_seconds,
            )
        except TimeoutError:
            try:
                await asyncio.to_thread(service.backup_now)
            except DatabaseBackupError:
                logger.exception("periodic database backup failed")


def _validate_production_configuration(
    settings: Settings,
    auth_service: AccessAuthService,
    llm_provider: LLMProvider,
    backup_service: DatabaseBackupService,
) -> None:
    if settings.app_env != "production":
        return
    if not auth_service.configured:
        raise RuntimeError("production authentication is not configured")
    if not settings.auth_cookie_secure:
        raise RuntimeError("production authentication cookie must be secure")
    if not llm_provider.configured:
        raise RuntimeError("production model service is not configured")
    if not backup_service.configured:
        raise RuntimeError("production database backup is not configured")
