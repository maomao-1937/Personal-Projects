from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


@dataclass(slots=True)
class DomainError(Exception):
    code: str
    message: str
    status_code: int = 400


def _trace_id(request: Request) -> str:
    return getattr(request.state, "trace_id", "unavailable")


def error_payload(request: Request, code: str, message: str) -> dict[str, object]:
    return {"error": {"code": code, "message": message, "trace_id": _trace_id(request)}}


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(request: Request, error: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content=error_payload(request, error.code, error.message),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        del error
        return JSONResponse(
            status_code=422,
            content=error_payload(request, "VALIDATION_ERROR", "请求参数不符合要求"),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, error: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR"
        message = "请求的资源不存在" if error.status_code == 404 else str(error.detail)
        return JSONResponse(
            status_code=error.status_code,
            content=error_payload(request, code, message),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        del error
        return JSONResponse(
            status_code=500,
            content=error_payload(request, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试"),
        )
