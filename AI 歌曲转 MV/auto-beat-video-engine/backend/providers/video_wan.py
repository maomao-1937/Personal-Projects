from __future__ import annotations

import httpx

from backend.domain.errors import DomainError
from backend.providers.video_common import (
    VideoTaskResult,
    download_mp4,
    optional_int,
    response_error_code,
    safe_error_code,
)


class DashScopeWanVideoProvider:
    STATUS_MAP = {
        "PENDING": "queued",
        "RUNNING": "running",
        "SUCCEEDED": "succeeded",
        "FAILED": "failed",
        "CANCELED": "cancelled",
        "CANCELLED": "cancelled",
    }
    SIZE_MAP = {
        ("480P", "16:9"): "832*480",
        ("480P", "9:16"): "480*832",
        ("480P", "1:1"): "624*624",
        ("720P", "16:9"): "1280*720",
        ("720P", "9:16"): "720*1280",
        ("720P", "1:1"): "960*960",
        ("720P", "4:3"): "1088*832",
        ("720P", "3:4"): "832*1088",
        ("1080P", "16:9"): "1920*1080",
        ("1080P", "9:16"): "1080*1920",
        ("1080P", "1:1"): "1440*1440",
        ("1080P", "4:3"): "1632*1248",
        ("1080P", "3:4"): "1248*1632",
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
                "百炼 Wan 视频模型尚未完整配置。",
                status_code=503,
            )
        base = base_url.rstrip("/")
        service_suffix = "/api/v1/services/aigc/video-generation/video-synthesis"
        if base.endswith(service_suffix):
            api_origin = base[: -len(service_suffix)]
            self._create_endpoint = base
            self._tasks_endpoint = f"{api_origin}/api/v1/tasks"
        elif base.endswith("/api/v1"):
            self._create_endpoint = f"{base}/services/aigc/video-generation/video-synthesis"
            self._tasks_endpoint = f"{base}/tasks"
        else:
            self._create_endpoint = f"{base}{service_suffix}"
            self._tasks_endpoint = f"{base}/api/v1/tasks"
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
        """Resume an accepted DashScope task; only create when no task ID exists."""

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
        resolution_name = resolution.upper()
        size = self.SIZE_MAP.get((resolution_name, ratio))
        if size is None:
            raise DomainError(
                "video_resolution_unsupported",
                "当前视频分辨率与画幅组合不受支持。",
                status_code=422,
            )
        provider_duration = 5 if self._uses_fixed_five_second_duration() else duration_seconds
        parameters: dict[str, object] = {
            "size": size,
            "prompt_extend": True,
            "watermark": False,
        }
        if not self._uses_fixed_five_second_duration():
            parameters["duration"] = duration_seconds
        response = self._request(
            "POST",
            self._create_endpoint,
            json={
                "model": self._model,
                "input": {"prompt": prompt.strip()},
                "parameters": parameters,
            },
            async_request=True,
        )
        try:
            payload = response.json()
            request_id = payload["output"]["task_id"]
            if not isinstance(request_id, str) or not request_id:
                raise ValueError
        except (ValueError, KeyError, TypeError) as exc:
            raise DomainError(
                "video_provider_invalid_response",
                "百炼 Wan 未返回有效任务 ID。",
                status_code=502,
                retryable=True,
            ) from exc
        return VideoTaskResult(
            provider_request_id=request_id,
            status="submitted",
            raw_status="SUBMITTED",
            model=self._model,
            resolution=resolution_name,
            ratio=ratio,
            duration_seconds=provider_duration,
        )

    def _uses_fixed_five_second_duration(self) -> bool:
        model = self._model.lower()
        return model.startswith(("wanx2.1-t2v", "wan2.1-t2v", "wan2.2-t2v-plus"))

    def query(self, provider_request_id: str) -> VideoTaskResult:
        if not provider_request_id:
            raise DomainError("video_task_id_required", "视频任务 ID 不能为空。", status_code=422)
        response = self._request("GET", f"{self._tasks_endpoint}/{provider_request_id}")
        try:
            payload = response.json()
            output = payload["output"]
            returned_id = output["task_id"]
            raw_status = output["task_status"]
            if returned_id != provider_request_id or raw_status not in self.STATUS_MAP:
                raise ValueError
            video_url = output.get("video_url")
            if not video_url:
                results = output.get("results") or []
                if isinstance(results, list) and results and isinstance(results[0], dict):
                    video_url = results[0].get("url")
            if raw_status == "SUCCEEDED" and not video_url:
                raise ValueError
            error_code = safe_error_code(output.get("code"))
        except (ValueError, KeyError, TypeError) as exc:
            raise DomainError(
                "video_provider_invalid_response",
                "百炼 Wan 返回了无法识别的任务状态。",
                status_code=502,
                retryable=True,
            ) from exc
        return VideoTaskResult(
            provider_request_id=returned_id,
            status=self.STATUS_MAP[raw_status],
            raw_status=raw_status,
            video_url=video_url,
            error_code=error_code,
            model=output.get("model") or payload.get("model") or self._model,
            resolution=output.get("resolution"),
            ratio=output.get("ratio"),
            duration_seconds=optional_int(output.get("duration")),
        )

    def download(self, video_url: str, *, max_bytes: int) -> bytes:
        return download_mp4(
            self._client,
            video_url,
            max_bytes=max_bytes,
            timeout_seconds=self._timeout_seconds,
        )

    def _request(
        self,
        method: str,
        url: str,
        *,
        json: dict[str, object] | None = None,
        async_request: bool = False,
    ) -> httpx.Response:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        if async_request:
            headers["X-DashScope-Async"] = "enable"
        try:
            response = self._client.request(
                method,
                url,
                headers=headers,
                json=json,
                timeout=self._timeout_seconds,
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise DomainError(
                "video_provider_unavailable",
                "百炼 Wan 服务暂时不可用。",
                status_code=502,
                retryable=True,
            ) from exc
        if response.status_code in {401, 403}:
            raise DomainError(
                "video_provider_auth_failed",
                "百炼 Wan 鉴权失败，请检查服务端配置。",
                status_code=502,
                retryable=False,
            )
        if response.status_code == 429:
            raise DomainError(
                "video_provider_rate_limited",
                "百炼 Wan 当前繁忙，请稍后重试。",
                status_code=502,
                retryable=True,
            )
        if response.status_code >= 500:
            raise DomainError(
                "video_provider_unavailable",
                "百炼 Wan 服务暂时不可用。",
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
                "百炼 Wan 拒绝了本次视频生成请求。",
                status_code=502,
                retryable=False,
                details=details,
            )
        return response
