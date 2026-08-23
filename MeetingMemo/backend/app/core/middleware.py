from time import monotonic
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_payload
from app.core.logging import log_http_request


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        trace_id = str(uuid4())
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        return response


class SameOriginMiddleware(BaseHTTPMiddleware):
    SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

    def __init__(
        self,
        app,
        *,
        frontend_origin: str,
        allow_originless_state_changes: bool,
    ) -> None:
        super().__init__(app)
        self.frontend_origin = frontend_origin.rstrip("/")
        self.allow_originless_state_changes = allow_originless_state_changes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in self.SAFE_METHODS:
            return await call_next(request)
        origin = request.headers.get("origin")
        is_origin_allowed = origin is not None and origin.rstrip("/") == self.frontend_origin
        if (origin is not None and not is_origin_allowed) or (
            origin is None and not self.allow_originless_state_changes
        ):
            return JSONResponse(
                status_code=403,
                content=error_payload(
                    request,
                    "ORIGIN_FORBIDDEN",
                    "请求来源不受信任",
                ),
            )
        return await call_next(request)


class RequestSizeLimitMiddleware:
    """Bound both declared and streamed request bodies.

    Bodies are preloaded only up to the configured hard limit and replayed to
    downstream code. This keeps FastAPI's body parser from translating an
    internal receive exception into a generic 400 response.
    """

    def __init__(self, app: ASGIApp, *, max_request_bytes: int) -> None:
        self.app = app
        self.max_request_bytes = max_request_bytes

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        raw_length = request.headers.get("content-length")
        if raw_length is not None:
            try:
                content_length = int(raw_length)
            except (TypeError, ValueError):
                response = JSONResponse(
                    status_code=400,
                    content=error_payload(
                        request,
                        "CONTENT_LENGTH_INVALID",
                        "Content-Length 无效",
                    ),
                )
                await response(scope, receive, send)
                return
            if content_length < 0:
                response = JSONResponse(
                    status_code=400,
                    content=error_payload(
                        request,
                        "CONTENT_LENGTH_INVALID",
                        "Content-Length 无效",
                    ),
                )
                await response(scope, receive, send)
                return
            if content_length > self.max_request_bytes:
                response = JSONResponse(
                    status_code=413,
                    content=error_payload(
                        request,
                        "REQUEST_TOO_LARGE",
                        "请求体超过大小限制",
                    ),
                )
                await response(scope, receive, send)
                return

        bytes_received = 0
        buffered_messages: list[Message] = []
        while True:
            message = await receive()
            buffered_messages.append(message)
            if message["type"] == "http.request":
                bytes_received += len(message.get("body", b""))
                if bytes_received > self.max_request_bytes:
                    response = JSONResponse(
                        status_code=413,
                        content=error_payload(
                            request,
                            "REQUEST_TOO_LARGE",
                            "请求体超过大小限制",
                        ),
                    )
                    await response(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break
            elif message["type"] == "http.disconnect":
                break

        buffered_index = 0

        async def replay_receive() -> Message:
            nonlocal buffered_index
            if buffered_index < len(buffered_messages):
                message = buffered_messages[buffered_index]
                buffered_index += 1
                return message
            return await receive()

        await self.app(scope, replay_receive, send)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started_at = monotonic()
        status_code = 500
        error_type = None
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as error:
            error_type = type(error).__name__
            raise
        finally:
            route = request.scope.get("route")
            route_template = getattr(route, "path", "<unmatched>")
            log_http_request(
                method=request.method,
                route=route_template,
                status_code=status_code,
                duration_ms=max(0, round((monotonic() - started_at) * 1000)),
                trace_id=getattr(request.state, "trace_id", "unavailable"),
                error_type=error_type,
            )
