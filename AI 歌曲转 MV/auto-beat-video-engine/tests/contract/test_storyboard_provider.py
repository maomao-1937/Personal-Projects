from __future__ import annotations

import json

import httpx
import pytest

from backend.domain.errors import DomainError
from backend.providers.storyboard_openai import OpenAICompatibleStoryboardProvider
from backend.services.storyboards import BeatPlan, BeatPlanSegment


def _beat_plan() -> BeatPlan:
    return BeatPlan(
        duration_ms=30_000,
        bpm=120,
        segments=[
            BeatPlanSegment(
                order_index=index,
                start_ms=index * 5_000,
                end_ms=(index + 1) * 5_000,
                energy_label="medium",
                cut_reason="beat",
            )
            for index in range(6)
        ],
    )


def _provider_payload() -> dict[str, object]:
    return {
        "plot": {
            "theme": "追光",
            "visual_arc": "从夜晚走向清晨",
            "emotional_arc": "克制到释放",
            "visual_style": "电影感现实主义",
        },
        "cuts": [
            {
                "start_ms": index * 5_000,
                "end_ms": (index + 1) * 5_000,
                "prompt": f"镜头 {index + 1}",
                "mood": "坚定",
                "camera": "缓慢推进",
                "action": "人物向前",
            }
            for index in range(6)
        ],
    }


def test_provider_uses_configured_endpoint_model_and_keeps_key_out_of_result() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["authorization"] = request.headers.get("authorization")
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(_provider_payload())}}]},
        )

    provider = OpenAICompatibleStoryboardProvider(
        api_key="top-secret",
        base_url="https://models.example/v1/",
        model="story-model",
        timeout_seconds=2,
        max_attempts=2,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    result = provider.generate(
        creative_brief="城市追光",
        audio_summary={"duration_ms": 30_000, "bpm": 120},
        beat_plan=_beat_plan(),
    )

    assert captured["url"] == "https://models.example/v1/chat/completions"
    assert captured["authorization"] == "Bearer top-secret"
    assert captured["body"]["model"] == "story-model"
    assert "top-secret" not in result.model_dump_json()


def test_invalid_json_is_retried_once_then_rejected() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"choices": [{"message": {"content": "not-json"}}]})

    provider = OpenAICompatibleStoryboardProvider(
        api_key="secret",
        base_url="https://models.example/v1",
        model="story-model",
        timeout_seconds=2,
        max_attempts=3,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(DomainError) as exc_info:
        provider.generate(
            creative_brief="测试",
            audio_summary={"duration_ms": 30_000},
            beat_plan=_beat_plan(),
        )

    assert calls == 2
    assert exc_info.value.code == "storyboard_invalid_response"
    assert exc_info.value.retryable is True


def test_auth_failure_is_not_retried_or_leaked() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(401, text="top-secret rejected")

    provider = OpenAICompatibleStoryboardProvider(
        api_key="top-secret",
        base_url="https://models.example/v1",
        model="story-model",
        timeout_seconds=2,
        max_attempts=3,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(DomainError) as exc_info:
        provider.generate(
            creative_brief="测试",
            audio_summary={},
            beat_plan=_beat_plan(),
        )

    assert calls == 1
    assert exc_info.value.code == "storyboard_provider_auth_failed"
    assert exc_info.value.retryable is False
    assert "top-secret" not in str(exc_info.value)
