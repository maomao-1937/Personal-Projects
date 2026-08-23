import json
import random
import time
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

import httpx
from pydantic import ValidationError

from app.core.errors import DomainError
from app.summaries.schemas import (
    ActionItem,
    Decision,
    OpenQuestion,
    PromptSegment,
    SummaryPayload,
    Topic,
)


class SummaryProvider(Protocol):
    def extract(self, segments: list[PromptSegment]) -> SummaryPayload:
        raise NotImplementedError

    def merge(self, partials: list[SummaryPayload]) -> SummaryPayload:
        raise NotImplementedError


def _unique_by(items: list, key: Callable) -> list:
    seen: set[str] = set()
    unique: list = []
    for item in items:
        value = key(item)
        if value not in seen:
            seen.add(value)
            unique.append(item)
    return unique


class MockSummaryProvider:
    def extract(self, segments: list[PromptSegment]) -> SummaryPayload:
        source_ids = [segment.id for segment in segments]
        joined = " ".join(segment.text for segment in segments)
        decisions: list[Decision] = []
        actions: list[ActionItem] = []
        questions: list[OpenQuestion] = []
        for segment in segments:
            lowered = segment.text.lower()
            if any(word in lowered for word in ("决定", "确认", "approved", "ship")):
                decisions.append(
                    Decision(
                        text=segment.text,
                        source_segment_ids=[segment.id],
                        confidence="high",
                    )
                )
            if any(word in lowered for word in ("我来", "负责", "i will", "todo")):
                actions.append(
                    ActionItem(
                        task=segment.text,
                        owner=segment.speaker,
                        due_date=None,
                        source_segment_ids=[segment.id],
                        confidence="high" if segment.speaker else "medium",
                    )
                )
            if "?" in segment.text or "？" in segment.text:
                questions.append(OpenQuestion(text=segment.text, source_segment_ids=[segment.id]))
        flags = ["NO_TIMESTAMPS"] if all(item.start_ms is None for item in segments) else []
        return SummaryPayload(
            summary_version="1.0",
            headline=f"已整理 {len(segments)} 个转录片段。",
            topics=[
                Topic(
                    title="会议讨论",
                    summary=joined[:1000],
                    source_segment_ids=source_ids,
                )
            ],
            decisions=decisions,
            action_items=actions,
            open_questions=questions,
            quality_flags=flags,
        )

    def merge(self, partials: list[SummaryPayload]) -> SummaryPayload:
        topics = [topic for partial in partials for topic in partial.topics]
        source_ids = list(
            dict.fromkeys(source_id for topic in topics for source_id in topic.source_segment_ids)
        )
        return SummaryPayload(
            summary_version="1.0",
            headline=f"已合并 {len(partials)} 个会议片段摘要。",
            topics=[
                Topic(
                    title="会议讨论",
                    summary=" ".join(topic.summary for topic in topics)[:4000],
                    source_segment_ids=source_ids,
                )
            ],
            decisions=_unique_by(
                [item for partial in partials for item in partial.decisions],
                lambda item: item.text,
            ),
            action_items=_unique_by(
                [item for partial in partials for item in partial.action_items],
                lambda item: item.task,
            ),
            open_questions=_unique_by(
                [item for partial in partials for item in partial.open_questions],
                lambda item: item.text,
            ),
            quality_flags=list(
                dict.fromkeys(flag for partial in partials for flag in partial.quality_flags)
            ),
        )


class OpenAICompatibleSummaryProvider:
    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str,
        model: str,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        max_retries: int = 2,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = client or httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0))
        self.sleep = sleep
        self.max_retries = max_retries
        self.system_prompt = (Path(__file__).parent / "prompts" / "summary_v1.txt").read_text(
            encoding="utf-8"
        )

    def extract(self, segments: list[PromptSegment]) -> SummaryPayload:
        payload = {
            "mode": "extract",
            "segments": [item.model_dump() for item in segments],
        }
        return self._generate(payload)

    def merge(self, partials: list[SummaryPayload]) -> SummaryPayload:
        payload = {
            "mode": "merge",
            "partial_summaries": [
                {"chunk_order": index, "summary": item.model_dump()}
                for index, item in enumerate(partials)
            ],
        }
        return self._generate(payload)

    def _generate(self, payload: dict[str, object]) -> SummaryPayload:
        raw = self._request(payload)
        try:
            return self._parse_content(raw)
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError):
            repaired = self._request(
                {
                    "mode": "repair",
                    "invalid_output": raw,
                    "instruction": "只修复 JSON 与 Schema，不新增会议事实。",
                }
            )
            try:
                return self._parse_content(repaired)
            except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as error:
                raise DomainError(
                    "LLM_RESPONSE_INVALID", "模型返回内容无法通过结构校验", 502
                ) from error

    def _request(self, payload: dict[str, object]) -> str:
        if not self.api_key:
            raise DomainError("LLM_NOT_CONFIGURED", "尚未配置模型 API Key", 503)
        request_json = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }
        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=request_json,
                )
            except (httpx.TimeoutException, httpx.TransportError) as error:
                if attempt == self.max_retries:
                    raise DomainError("LLM_UNAVAILABLE", "模型服务暂时不可用", 502) from error
                self._backoff(attempt)
                continue
            if response.status_code in {401, 403}:
                raise DomainError("LLM_AUTH_FAILED", "模型凭据无效", 502)
            if response.status_code == 429 or response.status_code >= 500:
                if attempt == self.max_retries:
                    raise DomainError("LLM_UNAVAILABLE", "模型服务暂时不可用", 502)
                self._backoff(attempt)
                continue
            if response.status_code >= 400:
                raise DomainError("LLM_REQUEST_FAILED", "模型请求未被接受", 502)
            try:
                return response.json()["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
                raise DomainError("LLM_RESPONSE_INVALID", "模型响应结构无效", 502) from error
        raise DomainError("LLM_UNAVAILABLE", "模型服务暂时不可用", 502)

    def _backoff(self, attempt: int) -> None:
        self.sleep((2**attempt) * 0.25 + random.random() * 0.05)

    @staticmethod
    def _parse_content(raw: str) -> SummaryPayload:
        stripped = raw.strip()
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            stripped = "\n".join(lines[1:-1]).strip()
        return SummaryPayload.model_validate(json.loads(stripped))
