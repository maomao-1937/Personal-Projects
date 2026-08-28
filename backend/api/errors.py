from __future__ import annotations

import secrets
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.domain.errors import DomainError


def _request_id(request: Request) -> str:
    supplied = request.headers.get("X-Request-ID", "")
    if supplied.isascii() and 1 <= len(supplied) <= 80:
        return supplied
    return f"req_{secrets.token_hex(8)}"


def _response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    retryable: bool = False,
    details: dict[str, Any] | list[dict[str, Any]] | None = None,
) -> JSONResponse:
    request_id = _request_id(request)
    return JSONResponse(
        status_code=status_code,
        headers={"X-Request-ID": request_id},
        content={
            "error": {
                "code": code,
                "message": message,
                "retryable": retryable,
                "details": details or {},
                "request_id": request_id,
            }
        },
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        safe_errors = [
            {"location": list(item["loc"]), "type": item["type"], "message": item["msg"]}
            for item in exc.errors()
        ]
        return _response(
            request,
            status_code=422,
            code="request_validation_failed",
            message="请求参数不合法。",
            details=safe_errors,
        )

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return _response(
            request,
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            retryable=exc.retryable,
            details=exc.details,
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return _response(
            request,
            status_code=exc.status_code,
            code="http_error",
            message=str(exc.detail),
        )
