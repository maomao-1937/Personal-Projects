from __future__ import annotations

import httpx

from backend.domain.errors import DomainError
from backend.providers.video_common import (
    VideoTaskResult,
    download_mp4,
    optional_int,
    response_error_code,
)


class ArkVideoProvider:
    STATUS_MAP = {
        "queued": "queued",
        "running": "running",
        "succeeded": "succeeded",
        "failed": "failed",
        "cancelled": "cancelled",
        "expired": "expired",
    }

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        timeout_seconds: float,
        client: httpx.Client | None = None,
    ) -> None:
        if not api_key or not base_url or not model:
            raise DomainError(
                "video_provider_not_configured",
                "Seedance 视频模型尚未完整配置。",
                status_code=503,
            )
        base = base_url.rstrip("/")
        self._tasks_endpoint = (
            base if base.endswith("/contents/generations/tasks") else f"{base}/contents/generations/tasks"
        )
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._client = client or httpx.Client(trust_env=False)

    def ensure_task(
        self,
        *,
        provider_request_id: str | None,
        prompt: str,
        duration_seconds: int,
        ratio: str,
        resolution: str,
    ) -> VideoTaskResult:
        """Resume an accepted Ark task; only create when no request ID exists."""

        if provider_request_id:
            return self.query(provider_request_id)
        return self.create(
            prompt=prompt,
            duration_seconds=duration_seconds,
            ratio=ratio,
            resolution=resolution,
        )

    def create(
        self,
        *,
        prompt: str,
        duration_seconds: int,
        ratio: str = "16:9",
        resolution: str = "720p",
    ) -> VideoTaskResult:
        if not prompt.strip():
            raise DomainError("video_prompt_required", "视频 Prompt 不能为空。", status_code=422)
        if not 4 <= duration_seconds <= 12:
            raise DomainError(
                "video_duration_unsupported",
                "P0 单 Cut 视频时长必须为 4—12 秒的整数。",
                status_code=422,
            )
        response = self._request(
            "POST",
            self._tasks_endpoint,
            json={
                "model": self._model,
                "content": [{"type": "text", "text": prompt.strip()}],
                "ratio": ratio,
                "duration": duration_seconds,
                "resolution": resolution,
                "watermark": False,
            },
        )
        try:
            request_id = response.json()["id"]
            if not isinstance(request_id, str) or not request_id:
                raise ValueError
        except (ValueError, KeyError, TypeError) as exc:
            raise DomainError(
                "video_provider_invalid_response",
                "Seedance 未返回有效任务 ID。",
                status_code=502,
                retryable=True,
            ) from exc
        return VideoTaskResult(
            provider_request_id=request_id,
            status="submitted",
            raw_status="submitted",
        )

    def query(self, provider_request_id: str) -> VideoTaskResult:
        if not provider_request_id:
            raise DomainError("video_task_id_required", "视频任务 ID 不能为空。", status_code=422)
        response = self._request("GET", f"{self._tasks_endpoint}/{provider_request_id}")
        try:
            payload = response.json()
            returned_id = payload["id"]
            raw_status = payload["status"]
            if returned_id != provider_request_id or raw_status not in self.STATUS_MAP:
                raise ValueError
            content = payload.get("content") or {}
            video_url = content.get("video_url")
            if raw_status == "succeeded" and not video_url:
                raise ValueError
            error = payload.get("error") or {}
            error_code = error.get("code") if isinstance(error, dict) else None
        except (ValueError, KeyError, TypeError) as exc:
            raise DomainError(
                "video_provider_invalid_response",
                "Seedance 返回了无法识别的任务状态。",
                status_code=502,
                retryable=True,
            ) from exc
        return VideoTaskResult(
            provider_request_id=returned_id,
            status=self.STATUS_MAP[raw_status],
            raw_status=raw_status,
            video_url=video_url,
            error_code=error_code,
            model=payload.get("model"),
            resolution=payload.get("resolution"),
            ratio=payload.get("ratio"),
            duration_seconds=optional_int(payload.get("duration")),
        )

    def download(self, video_url: str, *, max_bytes: int) -> bytes:
        return download_mp4(
            self._client,
            video_url,
            max_bytes=max_bytes,
            timeout_seconds=self._timeout_seconds,
        )

    def _request(self, method: str, url: str, *, json: dict[str, object] | None = None) -> httpx.Response:
        try:
            response = self._client.request(
                method,
                url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=json,
                timeout=self._timeout_seconds,
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise DomainError(
                "video_provider_unavailable",
                "Seedance 服务暂时不可用。",
                status_code=502,
                retryable=True,
            ) from exc
        if response.status_code in {401, 403}:
            raise DomainError(
                "video_provider_auth_failed",
                "Seedance 鉴权失败，请检查服务端配置。",
                status_code=502,
                retryable=False,
            )
        if response.status_code == 429:
            raise DomainError(
                "video_provider_rate_limited",
                "Seedance 当前繁忙，请稍后重试。",
                status_code=502,
                retryable=True,
            )
        if response.status_code >= 500:
            raise DomainError(
                "video_provider_unavailable",
                "Seedance 服务暂时不可用。",
                status_code=502,
                retryable=True,
                details={"provider_status": response.status_code},
            )
        if response.status_code >= 400:
            details: dict[str, object] = {"provider_status": response.status_code}
            provider_error_code = response_error_code(response)
            if provider_error_code:
                details["provider_error_code"] = provider_error_code
            raise DomainError(
                "video_provider_rejected",
                "Seedance 拒绝了本次视频生成请求。",
                status_code=502,
                retryable=False,
                details=details,
            )
        return response
