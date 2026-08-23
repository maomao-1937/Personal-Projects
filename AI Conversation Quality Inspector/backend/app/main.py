import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes import access, analyses, feedback, health, public_config
from app.core.config import Settings, get_settings
from app.core.database import (
    create_database_engine,
    create_session_factory,
    run_database_migrations,
)
from app.core.errors import AppError, BackupCredentialsUnavailable, BackupUnavailable
from app.core.logging import configure_logging
from app.core.middleware import install_request_middleware
from app.core.security import Security
from app.services.analysis import AnalysisService
from app.services.database_backup import (
    DatabaseBackupService,
    ObjectStore,
    S3ObjectStore,
    VefaasRequestObjectStore,
)
from app.services.feedback import FeedbackService
from app.services.invites import InviteService
from app.services.model_client import AnalysisModel, OpenAIModelClient
from app.services.quotas import QuotaService
from app.services.retention import RetentionService

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Runtime:
    settings: Settings
    engine: Engine
    session_factory: sessionmaker[Session]
    security: Security
    invite_service: InviteService
    quota_service: QuotaService
    analysis_service: AnalysisService
    feedback_service: FeedbackService
    retention_service: RetentionService
    backup_service: DatabaseBackupService | None


def create_app(
    settings: Settings | None = None,
    *,
    model_client: AnalysisModel | None = None,
    backup_store: ObjectStore | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    configure_logging()
    backup_service = _create_backup_service(resolved_settings, backup_store)
    lazy_vefaas_runtime = (
        backup_service is not None and resolved_settings.s3_auth_mode == "vefaas_request"
    )
    runtime: Runtime | None = None
    runtime_lock = asyncio.Lock()
    backup_lock = asyncio.Lock()
    backup_stop = asyncio.Event()
    backup_task: asyncio.Task[None] | None = None

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        nonlocal backup_task, runtime
        if not lazy_vefaas_runtime:
            runtime = await asyncio.to_thread(
                _initialize_runtime,
                resolved_settings,
                model_client,
                backup_service,
            )
            app.state.runtime = runtime
            backup_task = _start_periodic_backups(
                backup_service,
                resolved_settings.sqlite_backup_interval_seconds,
                backup_stop,
                backup_lock,
            )
        try:
            yield
        finally:
            backup_stop.set()
            if backup_task is not None:
                await backup_task
            try:
                if backup_service is not None and runtime is not None:
                    async with backup_lock:
                        await asyncio.to_thread(backup_service.backup)
                    logger.info("sqlite_snapshot_saved")
            finally:
                if runtime is not None:
                    runtime.engine.dispose()

    app = FastAPI(
        title="AI 对话质检器 API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if not resolved_settings.is_production else None,
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origin_list),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Idempotency-Key", "X-CSRF-Token"],
    )
    if lazy_vefaas_runtime:
        assert backup_service is not None

        async def vefaas_request_credentials(
            request: Request,
            call_next: Callable[[Request], Awaitable[Response]],
        ) -> Response:
            nonlocal backup_task, runtime
            credentials = _vefaas_request_credentials(request)
            if credentials is None:
                if request.url.path == "/health/live":
                    return await call_next(request)
                return _service_error_response(
                    request,
                    BackupCredentialsUnavailable(),
                )
            try:
                object_store = backup_service.object_store
                if isinstance(object_store, VefaasRequestObjectStore):
                    await asyncio.to_thread(
                        object_store.update_credentials,
                        *credentials,
                    )
                async with runtime_lock:
                    if runtime is None:
                        runtime = await asyncio.to_thread(
                            _initialize_runtime,
                            resolved_settings,
                            model_client,
                            backup_service,
                        )
                        app.state.runtime = runtime
                        backup_task = _start_periodic_backups(
                            backup_service,
                            resolved_settings.sqlite_backup_interval_seconds,
                            backup_stop,
                            backup_lock,
                        )
                if not backup_service.is_healthy(
                    max_age_seconds=resolved_settings.sqlite_backup_max_age_seconds
                ):
                    async with backup_lock:
                        if not backup_service.is_healthy(
                            max_age_seconds=(resolved_settings.sqlite_backup_max_age_seconds)
                        ):
                            await asyncio.to_thread(backup_service.backup)
                            logger.info("sqlite_snapshot_saved")
            except Exception:
                logger.exception("vefaas_runtime_initialization_failed")
                return _service_error_response(request, BackupUnavailable())
            return await call_next(request)

        app.middleware("http")(vefaas_request_credentials)
    install_request_middleware(app, resolved_settings.max_request_body_bytes)
    _install_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(access.router, prefix="/api/v1")
    app.include_router(analyses.router, prefix="/api/v1")
    app.include_router(feedback.router, prefix="/api/v1")
    app.include_router(public_config.router, prefix="/api/v1")
    return app


def _install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(request, exc),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        field_errors = [
            {
                "field": ".".join(str(part) for part in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        validation_error = AppError(
            code="VALIDATION_ERROR",
            message="请求参数不符合要求。",
            status_code=422,
            field_errors=field_errors,
        )
        return JSONResponse(
            status_code=422,
            content=_error_payload(request, validation_error),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_request_error",
            extra={"request_id": _request_id(request)},
        )
        internal_error = AppError(
            code="INTERNAL_ERROR",
            message="服务暂时不可用，请稍后重试。",
            status_code=500,
            retryable=True,
        )
        return JSONResponse(
            status_code=500,
            content=_error_payload(request, internal_error),
        )


def _error_payload(request: Request, error: AppError) -> dict[str, Any]:
    detail: dict[str, Any] = {
        "code": error.code,
        "message": error.message,
        "request_id": _request_id(request),
        "retryable": error.retryable,
    }
    if error.field_errors:
        detail["field_errors"] = error.field_errors
    return {"error": detail}


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", "unknown"))


def _ensure_sqlite_directory(database_url: str) -> None:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix) or database_url.endswith(":memory:"):
        return
    database_path = Path(database_url.removeprefix(prefix))
    database_path.parent.mkdir(parents=True, exist_ok=True)


def _initialize_runtime(
    settings: Settings,
    model_client: AnalysisModel | None,
    backup_service: DatabaseBackupService | None,
) -> Runtime:
    runtime: Runtime | None = None
    engine: Engine | None = None
    try:
        if backup_service is not None:
            restored = backup_service.restore_if_needed(
                allow_bootstrap=settings.sqlite_allow_bootstrap,
            )
            if restored:
                logger.info("sqlite_snapshot_restored")
        _ensure_sqlite_directory(settings.database_url)
        run_database_migrations(settings.database_url)
        engine = create_database_engine(settings.database_url)
        session_factory = create_session_factory(engine)
        security = Security(
            settings.session_secret.get_secret_value(),
            settings.invite_code_pepper.get_secret_value(),
            settings.access_ttl_seconds,
        )
        invite_service = InviteService(
            session_factory,
            security,
            usage_limit=settings.invite_usage_limit,
        )
        invite_service.sync_configured_codes(settings.configured_invite_codes)
        quota_service = QuotaService(
            session_factory,
            rubric_version=settings.rubric_version,
            prompt_version=settings.prompt_version,
            reservation_ttl_seconds=settings.reservation_ttl_seconds,
        )
        quota_service.reclaim_expired()
        retention_service = RetentionService(
            session_factory,
            retention_days=settings.metadata_retention_days,
        )
        retention_service.cleanup()
        model = model_client or OpenAIModelClient(settings)
        runtime = Runtime(
            settings=settings,
            engine=engine,
            session_factory=session_factory,
            security=security,
            invite_service=invite_service,
            quota_service=quota_service,
            analysis_service=AnalysisService(
                settings,
                quota_service,
                model,
                backup_health=backup_service,
            ),
            feedback_service=FeedbackService(session_factory),
            retention_service=retention_service,
            backup_service=backup_service,
        )
        if backup_service is not None:
            backup_service.backup()
            logger.info("sqlite_snapshot_saved")
        return runtime
    except Exception:
        if runtime is not None:
            runtime.engine.dispose()
        elif engine is not None:
            engine.dispose()
        raise


def _vefaas_request_credentials(request: Request) -> tuple[str, str, str] | None:
    credentials = (
        request.headers.get("x-faas-access-key-id", "").strip(),
        request.headers.get("x-faas-secret-access-key", "").strip(),
        request.headers.get("x-faas-session-token", "").strip(),
    )
    return credentials if all(credentials) else None


def _service_error_response(request: Request, error: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content=_error_payload(request, error),
    )


def _create_backup_service(
    settings: Settings,
    backup_store: ObjectStore | None,
) -> DatabaseBackupService | None:
    if settings.storage_provider != "s3" or not settings.database_url.startswith("sqlite"):
        return None
    if backup_store is not None:
        object_store = backup_store
    elif settings.s3_auth_mode == "vefaas_request":
        object_store = VefaasRequestObjectStore(
            endpoint=settings.s3_endpoint or "",
            region=settings.s3_region or "",
            bucket=settings.s3_bucket or "",
        )
    else:
        object_store = S3ObjectStore.create(
            endpoint=settings.s3_endpoint or "",
            region=settings.s3_region or "",
            bucket=settings.s3_bucket or "",
            access_key=(
                settings.s3_access_key.get_secret_value() if settings.s3_access_key else ""
            ),
            secret_key=(
                settings.s3_secret_key.get_secret_value() if settings.s3_secret_key else ""
            ),
        )
    return DatabaseBackupService(
        settings.database_url,
        object_store,
        object_prefix=settings.s3_object_prefix,
    )


def _start_periodic_backups(
    service: DatabaseBackupService | None,
    interval_seconds: int,
    stop: asyncio.Event,
    backup_lock: asyncio.Lock,
) -> asyncio.Task[None] | None:
    if service is None:
        return None
    return asyncio.create_task(
        _run_periodic_backups(
            service,
            interval_seconds,
            stop,
            backup_lock,
        )
    )


async def _run_periodic_backups(
    service: DatabaseBackupService,
    interval_seconds: int,
    stop: asyncio.Event,
    backup_lock: asyncio.Lock,
) -> None:
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval_seconds)
        except TimeoutError:
            try:
                async with backup_lock:
                    await asyncio.to_thread(service.backup)
                logger.info("sqlite_snapshot_saved")
            except Exception:
                logger.exception("sqlite_periodic_snapshot_failed")


app = create_app()
