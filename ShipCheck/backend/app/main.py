"""FastAPI 入口。"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1 import acceptance, invite, jobs, review, rewrite
from app.core.config import ensure_dirs, settings
from app.core.errors import (
    AppError,
    app_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logger import logger, setup_logging
from app.db import init_db, recover_jobs
from app.schemas.schemas import HealthResponse

STATIC_DIR = Path(__file__).resolve().parent / "static"
API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    ensure_dirs()
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    recover_jobs()
    logger.info(
        "ShipCheck 启动完成 (mock_mode=%s, port=%d)",
        settings.mock_mode,
        settings.app_port,
    )
    yield


app = FastAPI(title="ShipCheck", version="0.1.0", lifespan=lifespan)

# 异常处理(统一 {"error": {...}})
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

# 路由
app.include_router(invite.router, prefix=API_PREFIX)
app.include_router(acceptance.router, prefix=API_PREFIX)
app.include_router(review.router, prefix=API_PREFIX)
app.include_router(jobs.router, prefix=API_PREFIX)
app.include_router(rewrite.router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health", response_model=HealthResponse, tags=["health"])
def health():
    return HealthResponse(mock_mode=settings.mock_mode)


# 根路径直接返回临时验收页(方便直接打开 /)
INDEX_HTML = STATIC_DIR / "index.html"


@app.get("/", include_in_schema=False)
def root_index():
    if INDEX_HTML.exists():
        return FileResponse(INDEX_HTML, media_type="text/html")
    return {"detail": "Not Found"}


@app.get("/index.html", include_in_schema=False)
def root_index_html():
    if INDEX_HTML.exists():
        return FileResponse(INDEX_HTML, media_type="text/html")
    return {"detail": "Not Found"}


# 静态资源:最小验收页 + 截图访问
app.mount(
    "/static", StaticFiles(directory=str(STATIC_DIR), html=True), name="static"
)
app.mount(
    "/screenshots",
    StaticFiles(directory=str(settings.abs_screenshot_dir)),
    name="screenshots",
)
