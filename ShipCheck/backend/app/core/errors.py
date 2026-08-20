"""统一错误响应。所有异常 → {"error": {"code", "message"}},不泄露堆栈。"""
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .logger import logger


class AppError(Exception):
    """业务错误。code=机读码,message=人读说明,status_code=HTTP 状态。"""

    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def make_error(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=make_error(exc.code, exc.message),
    )


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=make_error("validation_error", "请求参数校验失败"),
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # 记录完整堆栈到日志,但不回给客户端
    logger.exception("Unhandled error: %s", type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content=make_error("internal_error", "服务内部错误"),
    )
