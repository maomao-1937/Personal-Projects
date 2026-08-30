import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.routers import auth, uploads, styles, portraits, orders
from app.seed import seed_styles
from app.utils.rate_limiter import limiter, rate_limit_exceeded_handler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# 注册限流器到应用状态
app.state.limiter = limiter

# 限流异常处理器
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/generated", StaticFiles(directory=str(settings.GENERATED_DIR)), name="generated")


# ============================================================
# 全局异常处理器
# ============================================================

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """处理 HTTPException

    保持原有状态码和错误信息，统一响应格式。
    """
    # 根据状态码生成错误码
    error_code = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        402: "PAYMENT_REQUIRED",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMIT_EXCEEDED",
    }.get(exc.status_code, f"HTTP_{exc.status_code}")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            "code": error_code,
        },
        headers=exc.headers if hasattr(exc, "headers") and exc.headers else None,
    )


# 同时注册 FastAPI 和 Starlette 的 HTTPException
# (Starlette 路由层抛出的 404/405 等使用 StarletteHTTPException)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """处理请求参数校验错误 (Pydantic ValidationError)

    返回统一格式的 400 错误，提取第一个错误信息。
    """
    errors = exc.errors()
    if errors:
        # 提取第一个错误的字段和消息
        first_error = errors[0]
        field = ".".join(str(loc) for loc in first_error.get("loc", []))
        msg = first_error.get("msg", "参数校验失败")
        detail = f"{field}: {msg}" if field else msg
    else:
        detail = "参数校验失败"

    logger.warning(f"参数校验失败: {detail}, path: {request.url.path}")

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "detail": detail,
            "code": "VALIDATION_ERROR",
        },
    )


@app.exception_handler(Exception)
async def uncaught_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """处理未捕获的全局异常

    返回 500 错误，记录日志，不暴露堆栈信息。
    """
    logger.error(
        f"未捕获的异常: {type(exc).__name__}: {str(exc)}, path: {request.url.path}",
        exc_info=True,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "服务器内部错误，请稍后重试",
            "code": "INTERNAL_SERVER_ERROR",
        },
    )


# ============================================================
# 生命周期事件
# ============================================================

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_styles(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "ai_configured": ai_service.is_configured,
    }


from app.services.ai_service import ai_service

app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(styles.router)
app.include_router(portraits.router)
app.include_router(orders.router)
