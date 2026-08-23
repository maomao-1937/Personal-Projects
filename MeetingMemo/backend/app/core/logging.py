import json
import logging

HTTP_LOGGER_NAME = "meetingmemo.http"


def configure_safe_logging() -> None:
    for logger_name in (HTTP_LOGGER_NAME, "meetingmemo.background"):
        logger = logging.getLogger(logger_name)
        logger.disabled = False
        logger.setLevel(logging.INFO)
        if not any(getattr(handler, "meetingmemo_safe", False) for handler in logger.handlers):
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter("%(message)s"))
            handler.meetingmemo_safe = True
            logger.addHandler(handler)
        logger.propagate = True


def log_http_request(
    *,
    method: str,
    route: str,
    status_code: int,
    duration_ms: int,
    trace_id: str,
    error_type: str | None = None,
) -> None:
    fields: dict[str, str | int] = {
        "event": "http_request",
        "method": method,
        "path": route,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "trace_id": trace_id,
    }
    if error_type is not None:
        fields["error_type"] = error_type
    logging.getLogger(HTTP_LOGGER_NAME).info(
        json.dumps(fields, ensure_ascii=False, separators=(",", ":"))
    )


def log_background_error(*, component: str, error_type: str) -> None:
    logging.getLogger("meetingmemo.background").error(
        json.dumps(
            {
                "event": "background_error",
                "component": component,
                "error_type": error_type,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
    )
