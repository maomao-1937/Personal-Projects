from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel

from backend.domain.errors import DomainError


class VideoTaskResult(BaseModel):
    provider_request_id: str
    status: str
    raw_status: str
    video_url: str | None = None
    error_code: str | None = None
    model: str | None = None
    resolution: str | None = None
    ratio: str | None = None
    duration_seconds: int | None = None


def download_mp4(
    client: httpx.Client,
    video_url: str,
    *,
    max_bytes: int,
    timeout_seconds: float,
) -> bytes:
    _validate_download_url(video_url)
    try:
        with client.stream(
            "GET",
            video_url,
            timeout=timeout_seconds,
            headers={"Accept": "video/mp4"},
        ) as response:
            if response.status_code >= 400 or 300 <= response.status_code < 400:
                raise DomainError(
                    "video_download_failed",
                    "生成视频下载失败。",
                    status_code=502,
                    retryable=response.status_code == 429 or response.status_code >= 500,
                    details={"provider_status": response.status_code},
                )
            content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
            if content_type not in {"video/mp4", "application/mp4"}:
                raise DomainError(
                    "video_download_invalid_type",
                    "生成结果不是受支持的 MP4 视频。",
                    status_code=502,
                    retryable=False,
                )
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > max_bytes:
                raise _too_large(max_bytes)
            chunks: list[bytes] = []
            received = 0
            for chunk in response.iter_bytes():
                received += len(chunk)
                if received > max_bytes:
                    raise _too_large(max_bytes)
                chunks.append(chunk)
            return b"".join(chunks)
    except DomainError:
        raise
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        raise DomainError(
            "video_download_failed",
            "生成视频下载失败。",
            status_code=502,
            retryable=True,
        ) from exc


def optional_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def safe_error_code(value: object) -> str | None:
    if not isinstance(value, str) or not 1 <= len(value) <= 128:
        return None
    if not all(character.isalnum() or character in "._-" for character in value):
        return None
    return value


def response_error_code(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    if not isinstance(payload, dict):
        return None
    direct = safe_error_code(payload.get("code"))
    if direct:
        return direct
    error = payload.get("error")
    return safe_error_code(error.get("code")) if isinstance(error, dict) else None


def _validate_download_url(url: str) -> None:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    rejected = (
        parsed.scheme != "https"
        or not hostname
        or hostname == "localhost"
        or hostname.endswith(".localhost")
    )
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        rejected = True
    if rejected:
        raise DomainError(
            "video_download_url_rejected",
            "生成视频下载地址不安全。",
            status_code=502,
            retryable=False,
        )


def _too_large(max_bytes: int) -> DomainError:
    return DomainError(
        "video_download_too_large",
        "生成视频超过服务端允许的大小。",
        status_code=502,
        retryable=False,
        details={"max_bytes": max_bytes},
    )
