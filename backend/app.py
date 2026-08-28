from __future__ import annotations

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from backend.api.artifacts import build_artifacts_router
from backend.api.audio import build_audio_router
from backend.api.audio_analysis import build_audio_analysis_router
from backend.api.auth import build_auth_router
from backend.api.cuts import build_cuts_router
from backend.api.errors import install_error_handlers
from backend.api.exports import build_exports_router
from backend.api.jobs import build_jobs_router
from backend.api.previews import build_previews_router
from backend.api.projects import build_projects_router
from backend.api.storyboards import build_storyboards_router
from backend.api.timelines import build_timelines_router
from backend.config import Settings
from backend.domain.errors import DomainError
from backend.jobs.handlers import HandlerRegistry
from backend.jobs.recovery import RecoveryService
from backend.jobs.service import JobService
from backend.jobs.worker import JobWorker
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.providers.audio_librosa import LibrosaAudioAnalysisProvider
from backend.providers.render_ffmpeg import FFmpegRenderProvider
from backend.providers.storyboard_openai import OpenAICompatibleStoryboardProvider
from backend.providers.video_ark import ArkVideoProvider
from backend.services.audio import AudioService
from backend.services.audio_analysis import AudioAnalysisHandler, AudioAnalysisService
from backend.services.auth import AuthService
from backend.services.cuts import CutGenerationHandler, CutService
from backend.services.projects import ProjectService
from backend.services.rendering import ExportRenderHandler, PreviewRenderHandler, RenderingService
from backend.services.retention import RetentionService
from backend.services.storyboards import StoryboardGenerationHandler, StoryboardService
from backend.services.timelines import TimelineService
from backend.storage.local_artifacts import LocalArtifactStore
from backend.version import APP_VERSION


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class _DisabledStoryboardProvider:
    def generate(self, **_):
        raise DomainError(
            "storyboard_provider_not_configured",
            "Storyboard 文本模型尚未配置。",
            status_code=503,
        )


class _DisabledVideoProvider:
    def ensure_task(self, **_):
        raise DomainError("video_provider_not_configured", "视频模型尚未配置。", status_code=503)

    def query(self, _provider_request_id):
        raise DomainError("video_provider_not_configured", "视频模型尚未配置。", status_code=503)

    def download(self, _video_url, *, max_bytes):
        raise DomainError("video_provider_not_configured", "视频模型尚未配置。", status_code=503)


def create_app(app_settings: Settings | None = None) -> FastAPI:
    config = app_settings or Settings()
    database = Database(config.app_database_path)
    repositories = Repositories(database)
    artifacts = LocalArtifactStore(config.app_artifact_root)
    auth = AuthService(database, session_ttl_seconds=config.app_session_ttl_seconds)
    projects = ProjectService(repositories.projects)
    jobs = JobService(database)
    audio = AudioService(
        database,
        projects,
        artifacts,
        max_bytes=config.app_upload_max_bytes,
        min_seconds=config.app_audio_min_seconds,
        max_seconds=config.app_audio_max_seconds,
    )
    audio_analyses = AudioAnalysisService(database, projects, jobs)
    storyboards = StoryboardService(
        database,
        projects,
        _storyboard_provider(config),
        max_cut_count=config.app_cut_max_count,
        jobs=jobs,
    )
    cuts = CutService(database, projects, jobs, max_cut_count=config.app_cut_max_count)
    timelines = TimelineService(database, projects)
    rendering = RenderingService(database, projects, timelines, jobs)
    video_provider = _video_provider(config)
    ffmpeg = FFmpegRenderProvider(timeout_seconds=config.render_job_deadline_seconds)
    registry = HandlerRegistry()
    registry.register(
        "audio_analysis",
        AudioAnalysisHandler(database, jobs, artifacts, LibrosaAudioAnalysisProvider()),
    )
    registry.register("storyboard_generation", StoryboardGenerationHandler(storyboards))
    registry.register(
        "cut_video_generation",
        CutGenerationHandler(
            database,
            jobs,
            artifacts,
            video_provider,
            poll_interval_seconds=config.video_poll_interval_seconds,
            max_download_bytes=config.app_upload_max_bytes,
            deadline_seconds=config.video_job_deadline_seconds,
        ),
    )
    registry.register("preview_render", PreviewRenderHandler(database, jobs, artifacts, ffmpeg))
    registry.register("export_render", ExportRenderHandler(database, jobs, artifacts, ffmpeg))
    worker_count = config.app_video_concurrency

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database.initialize()
        hashes = filter(None, (item.strip() for item in config.app_invite_code_hashes.split(",")))
        for code_hash in hashes:
            auth.add_invite_code_hash(code_hash)
        app.state.recovered_jobs = await RecoveryService(jobs).run_once()
        app.state.expired_artifacts = (
            RetentionService(
                database,
                artifacts,
                retention_days=config.app_asset_retention_days,
            ).purge_inactive()
            if config.app_env == "production"
            else 0
        )
        stop = asyncio.Event()
        workers = [
            asyncio.create_task(
                _worker_loop(JobWorker(jobs, registry, worker_id=f"worker-{index + 1}"), stop)
            )
            for index in range(worker_count)
        ]
        app.state.worker_count = worker_count
        try:
            yield
        finally:
            stop.set()
            for worker in workers:
                worker.cancel()
            await asyncio.gather(*workers, return_exceptions=True)

    app = FastAPI(title="AI Song to MV Backend", version=APP_VERSION, lifespan=lifespan)
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health")
    def health() -> dict[str, object]:
        return {"status": "ok", "version": APP_VERSION, "config": config.safe_summary()}

    @app.get("/acceptance", response_class=HTMLResponse)
    def acceptance() -> str:
        return (BACKEND_DIR / "web" / "acceptance.html").read_text(encoding="utf-8")

    app.include_router(build_auth_router(auth))
    app.include_router(build_projects_router(projects, auth))
    app.include_router(build_audio_router(audio, auth))
    app.include_router(build_audio_analysis_router(audio_analyses, auth))
    app.include_router(build_storyboards_router(storyboards, auth))
    app.include_router(build_timelines_router(timelines, auth))
    app.include_router(build_cuts_router(cuts, auth))
    app.include_router(build_previews_router(rendering, auth))
    app.include_router(build_exports_router(rendering, auth))
    app.include_router(build_jobs_router(jobs, auth=auth, projects=projects))
    app.include_router(build_artifacts_router(database, projects, auth, artifacts))

    from backend.routers import download, process, status

    app.include_router(process.router, prefix="/api", tags=["legacy"])
    app.include_router(status.router, prefix="/api", tags=["legacy"])
    app.include_router(download.router, prefix="/api", tags=["legacy"])
    app.state.database = database
    app.state.jobs = jobs
    app.state.services = {
        "auth": auth,
        "projects": projects,
        "audio": audio,
        "audio_analyses": audio_analyses,
        "storyboards": storyboards,
        "cuts": cuts,
        "timelines": timelines,
        "rendering": rendering,
    }
    return app


async def _worker_loop(worker: JobWorker, stop: asyncio.Event) -> None:
    while not stop.is_set():
        worked = await worker.run_once()
        if not worked:
            try:
                await asyncio.wait_for(stop.wait(), timeout=0.1)
            except TimeoutError:
                pass


def _storyboard_provider(config: Settings):
    if config.storyboard_api_key and config.storyboard_base_url and config.storyboard_model:
        return OpenAICompatibleStoryboardProvider(
            api_key=config.storyboard_api_key.get_secret_value(),
            base_url=config.storyboard_base_url,
            model=config.storyboard_model,
            timeout_seconds=config.storyboard_timeout_seconds,
            max_attempts=config.storyboard_max_attempts,
        )
    return _DisabledStoryboardProvider()


def _video_provider(config: Settings):
    if config.video_api_key and config.video_base_url and config.video_model:
        return ArkVideoProvider(
            api_key=config.video_api_key.get_secret_value(),
            base_url=config.video_base_url,
            model=config.video_model,
            timeout_seconds=config.video_request_timeout_seconds,
        )
    return _DisabledVideoProvider()
