from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import ValidationError

from backend.domain.errors import DomainError
from backend.services.storyboards import BeatPlan, StoryboardDraft


class OpenAICompatibleStoryboardProvider:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        timeout_seconds: float,
        max_attempts: int,
        client: httpx.Client | None = None,
    ) -> None:
        if not api_key or not base_url or not model:
            raise DomainError(
                "storyboard_provider_not_configured",
                "Storyboard 文本模型尚未完整配置。",
                status_code=503,
            )
        self._api_key = api_key
        self._endpoint = f"{base_url.rstrip('/')}/chat/completions"
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._max_attempts = max(1, max_attempts)
        self._client = client or httpx.Client(trust_env=False)

    def generate(
        self,
        *,
        creative_brief: str,
        audio_summary: dict[str, object],
        beat_plan: BeatPlan,
    ) -> StoryboardDraft:
        messages = self._messages(creative_brief, audio_summary, beat_plan)
        structure_repair_used = False
        last_transport_error: Exception | None = None

        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._client.post(
                    self._endpoint,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self._model,
                        "messages": messages,
                        "response_format": {"type": "json_object"},
                        "temperature": 0.7,
                    },
                    timeout=self._timeout_seconds,
                )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_transport_error = exc
                if attempt < self._max_attempts:
                    continue
                raise DomainError(
                    "storyboard_provider_unavailable",
                    "Storyboard 模型暂时不可用。",
                    status_code=502,
                    retryable=True,
                ) from exc

            if response.status_code in {401, 403}:
                raise DomainError(
                    "storyboard_provider_auth_failed",
                    "Storyboard 模型鉴权失败，请检查服务端配置。",
                    status_code=502,
                    retryable=False,
                )
            if response.status_code in {400, 402, 422}:
                raise DomainError(
                    "storyboard_provider_rejected",
                    "Storyboard 模型拒绝了本次请求。",
                    status_code=502,
                    retryable=False,
                    details={"provider_status": response.status_code},
                )
            if response.status_code == 429 or response.status_code >= 500:
                if attempt < self._max_attempts:
                    continue
                raise DomainError(
                    "storyboard_provider_rate_limited"
                    if response.status_code == 429
                    else "storyboard_provider_unavailable",
                    "Storyboard 模型繁忙，请稍后重试。",
                    status_code=502,
                    retryable=True,
                    details={"provider_status": response.status_code},
                )
            if response.status_code >= 400:
                raise DomainError(
                    "storyboard_provider_failed",
                    "Storyboard 模型调用失败。",
                    status_code=502,
                    retryable=False,
                    details={"provider_status": response.status_code},
                )

            try:
                content = _extract_content(response.json())
                return StoryboardDraft.model_validate(json.loads(_strip_json_fence(content)))
            except (ValueError, TypeError, KeyError, ValidationError):
                if not structure_repair_used and attempt < self._max_attempts:
                    structure_repair_used = True
                    messages = [
                        *messages,
                        {"role": "assistant", "content": content if "content" in locals() else ""},
                        {
                            "role": "user",
                            "content": "上一个输出不是合法 JSON。仅按给定 JSON Schema 重新输出完整对象，不要使用 Markdown。",
                        },
                    ]
                    continue
                raise DomainError(
                    "storyboard_invalid_response",
                    "Storyboard 模型未返回合法的结构化分镜。",
                    status_code=502,
                    retryable=True,
                )

        raise DomainError(
            "storyboard_provider_unavailable",
            "Storyboard 模型暂时不可用。",
            status_code=502,
            retryable=True,
        ) from last_transport_error

    @staticmethod
    def _messages(
        creative_brief: str,
        audio_summary: dict[str, object],
        beat_plan: BeatPlan,
    ) -> list[dict[str, str]]:
        input_payload = {
            "creative_brief": creative_brief,
            "audio_summary": audio_summary,
            "beat_plan": beat_plan.provider_summary(),
            "rules": {
                "required_cut_count": len(beat_plan.segments),
                "timing_is_server_authoritative": True,
                "language": "zh-CN",
            },
            "output_json_schema": StoryboardDraft.model_json_schema(),
        }
        return [
            {
                "role": "system",
                "content": "你是音乐 MV 导演。只返回一个符合 JSON Schema 的 JSON 对象，不要输出 Markdown。",
            },
            {
                "role": "user",
                "content": json.dumps(input_payload, ensure_ascii=False, sort_keys=True),
            },
        ]


def _extract_content(payload: Any) -> str:
    content = payload["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise ValueError("empty model content")
    return content


def _strip_json_fence(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("```json") and stripped.endswith("```"):
        return stripped[7:-3].strip()
    if stripped.startswith("```") and stripped.endswith("```"):
        return stripped[3:-3].strip()
    return stripped
