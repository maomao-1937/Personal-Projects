from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.core.errors import RequestTooLarge

SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def install_request_middleware(app: FastAPI, max_body_bytes: int) -> None:
    async def request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = str(uuid4())
        request.state.request_id = request_id
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > max_body_bytes:
            return _with_security_headers(_request_too_large_response(request_id), request_id)
        if request.method in {"POST", "PUT", "PATCH"}:
            body = await request.body()
            if len(body) > max_body_bytes:
                return _with_security_headers(_request_too_large_response(request_id), request_id)

        response = await call_next(request)
        return _with_security_headers(response, request_id)

    app.middleware("http")(request_context)


def _request_too_large_response(request_id: str) -> JSONResponse:
    error = RequestTooLarge()
    return JSONResponse(
        status_code=error.status_code,
        content={
            "error": {
                "code": error.code,
                "message": error.message,
                "request_id": request_id,
                "retryable": error.retryable,
            }
        },
    )


def _with_security_headers(response: Response, request_id: str) -> Response:
    response.headers["X-Request-ID"] = request_id
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    return response
