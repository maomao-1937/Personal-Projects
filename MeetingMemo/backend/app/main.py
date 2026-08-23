from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.access.router import router as access_router
from app.core.config import Settings, get_settings
from app.core.database import (
    Base,
    create_database_engine,
    create_session_factory,
    load_all_models,
)
from app.core.errors import install_exception_handlers
from app.core.logging import configure_safe_logging
from app.core.middleware import (
    RequestLoggingMiddleware,
    RequestSizeLimitMiddleware,
    SameOriginMiddleware,
    TraceIdMiddleware,
)
from app.health.router import router as health_router
from app.integrations.providers import build_delivery_providers
from app.integrations.router import router as integrations_router
from app.jobs.router import router as jobs_router
from app.jobs.runner import SummaryJobRunner
from app.meetings.router import feedback_router
from app.meetings.router import router as meetings_router
from app.summaries.router import router as summaries_router


def create_app(settings: Settings | None = None, start_runner: bool = True) -> FastAPI:
    resolved_settings = settings or get_settings()
    if resolved_settings.app_env == "production":
        missing = resolved_settings.missing_production_secrets()
        if missing:
            raise RuntimeError(
                "unsafe production configuration; missing: " + ", ".join(sorted(missing))
            )
    configure_safe_logging()
    load_all_models()
    engine = create_database_engine(resolved_settings.database_url)
    session_factory = create_session_factory(engine)
    if resolved_settings.app_env == "test":
        Base.metadata.create_all(engine)
    runner = SummaryJobRunner(resolved_settings, session_factory)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if start_runner:
            runner.start()
        yield
        if start_runner:
            runner.stop()
        engine.dispose()

    app = FastAPI(title="MeetingMemo API", version="0.1.0", lifespan=lifespan)
    app.state.settings = resolved_settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.job_runner = runner
    app.state.delivery_providers = build_delivery_providers(resolved_settings)
    app.state.start_runner = start_runner
    app.add_middleware(
        SameOriginMiddleware,
        frontend_origin=resolved_settings.frontend_origin,
        allow_originless_state_changes=(resolved_settings.originless_state_changes_allowed),
    )
    app.add_middleware(
        RequestSizeLimitMiddleware,
        max_request_bytes=resolved_settings.max_request_bytes,
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(TraceIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[resolved_settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Requested-With"],
    )
    install_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(access_router)
    app.include_router(meetings_router)
    app.include_router(feedback_router)
    app.include_router(jobs_router)
    app.include_router(summaries_router)
    app.include_router(integrations_router)
    if (
        resolved_settings.static_site_dir is not None
        and resolved_settings.static_site_dir.is_dir()
        and (resolved_settings.static_site_dir / "index.html").is_file()
    ):
        app.mount(
            "/",
            StaticFiles(directory=resolved_settings.static_site_dir, html=True),
            name="static-site",
        )
    return app


app = create_app()
