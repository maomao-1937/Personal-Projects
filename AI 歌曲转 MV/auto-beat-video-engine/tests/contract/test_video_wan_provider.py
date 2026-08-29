from __future__ import annotations

import json

import httpx
import pytest

from backend.domain.errors import DomainError
from backend.providers.video_wan import DashScopeWanVideoProvider


def test_create_task_uses_dashscope_async_video_protocol() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"output": {"task_id": "wan-created"}})

    provider = _provider(handler)
    task = provider.ensure_task(
        provider_request_id=None,
        prompt="雨夜中的歌手，镜头缓慢推进",
        duration_seconds=5,
        ratio="16:9",
        resolution="720p",
    )

    assert task.provider_request_id == "wan-created"
    assert task.status == "submitted"
    assert captured["method"] == "POST"
    assert captured["url"] == (
        "https://dashscope.example/api/v1/services/aigc/video-generation/video-synthesis"
    )
    assert captured["headers"]["x-dashscope-async"] == "enable"
    assert captured["body"] == {
        "model": "wanx2.1-t2v-turbo",
        "input": {"prompt": "雨夜中的歌手，镜头缓慢推进"},
        "parameters": {
            "size": "1280*720",
            "prompt_extend": True,
            "watermark": False,
        },
    }


def test_fixed_duration_model_omits_unsupported_duration_and_reports_five_seconds() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"output": {"task_id": "wan-fixed"}})

    task = _provider(handler).create(
        prompt="星空下的舞者",
        duration_seconds=12,
        ratio="9:16",
        resolution="480p",
    )

    assert captured["body"]["parameters"] == {
        "size": "480*832",
        "prompt_extend": True,
        "watermark": False,
    }
    assert task.duration_seconds == 5


def test_variable_duration_wan_model_keeps_requested_duration() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"output": {"task_id": "wan-variable"}})

    provider = DashScopeWanVideoProvider(
        api_key="dashscope-secret",
        base_url="https://dashscope.example",
        model="wan2.6-t2v",
        timeout_seconds=2,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    task = provider.create(
        prompt="星空下的舞者",
        duration_seconds=12,
        ratio="16:9",
        resolution="720p",
    )

    assert captured["body"]["parameters"]["duration"] == 12
    assert task.duration_seconds == 12


def test_unsupported_resolution_ratio_combination_is_rejected_before_request() -> None:
    provider = _provider(lambda _: pytest.fail("request must not be sent"))

    with pytest.raises(DomainError) as exc_info:
        provider.create(
            prompt="测试",
            duration_seconds=5,
            ratio="4:3",
            resolution="480p",
        )

    assert exc_info.value.code == "video_resolution_unsupported"


@pytest.mark.parametrize(
    "base_url",
    [
        "https://workspace.example/api/v1",
        "https://workspace.example/api/v1/services/aigc/video-generation/video-synthesis",
    ],
)
def test_base_url_accepts_api_root_or_full_service_endpoint(base_url: str) -> None:
    urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        urls.append(str(request.url))
        if request.method == "POST":
            return httpx.Response(200, json={"output": {"task_id": "wan-base"}})
        return httpx.Response(
            200,
            json={"output": {"task_id": "wan-base", "task_status": "RUNNING"}},
        )

    provider = DashScopeWanVideoProvider(
        api_key="dashscope-secret",
        base_url=base_url,
        model="wanx2.1-t2v-turbo",
        timeout_seconds=2,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    provider.create(prompt="测试", duration_seconds=5)
    provider.query("wan-base")

    assert urls == [
        "https://workspace.example/api/v1/services/aigc/video-generation/video-synthesis",
        "https://workspace.example/api/v1/tasks/wan-base",
    ]


@pytest.mark.parametrize(
    ("raw_status", "expected_status"),
    [
        ("PENDING", "queued"),
        ("RUNNING", "running"),
        ("SUCCEEDED", "succeeded"),
        ("FAILED", "failed"),
        ("CANCELED", "cancelled"),
    ],
)
def test_query_maps_dashscope_task_status(raw_status: str, expected_status: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://dashscope.example/api/v1/tasks/wan-existing"
        output: dict[str, object] = {
            "task_id": "wan-existing",
            "task_status": raw_status,
        }
        if raw_status == "SUCCEEDED":
            output["video_url"] = "https://media.example/result.mp4"
        if raw_status == "FAILED":
            output["code"] = "DataInspectionFailed"
        return httpx.Response(200, json={"output": output})

    task = _provider(handler).query("wan-existing")

    assert task.provider_request_id == "wan-existing"
    assert task.status == expected_status
    assert task.raw_status == raw_status
    if raw_status == "SUCCEEDED":
        assert task.video_url == "https://media.example/result.mp4"
    if raw_status == "FAILED":
        assert task.error_code == "DataInspectionFailed"


def test_query_accepts_result_list_url_and_never_recreates_existing_task() -> None:
    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(
            200,
            json={
                "output": {
                    "task_id": "wan-existing",
                    "task_status": "SUCCEEDED",
                    "results": [{"url": "https://media.example/result.mp4"}],
                }
            },
        )

    task = _provider(handler).ensure_task(
        provider_request_id="wan-existing",
        prompt="must-not-submit",
        duration_seconds=5,
        ratio="16:9",
        resolution="720p",
    )

    assert methods == ["GET"]
    assert task.video_url == "https://media.example/result.mp4"


def test_rejected_request_exposes_only_safe_dashscope_error_code() -> None:
    provider = _provider(
        lambda _: httpx.Response(
            400,
            json={"code": "InvalidParameter", "message": "sensitive provider detail"},
        )
    )

    with pytest.raises(DomainError) as exc_info:
        provider.create(prompt="测试", duration_seconds=5, ratio="16:9", resolution="720p")

    assert exc_info.value.details == {
        "provider_status": 400,
        "provider_error_code": "InvalidParameter",
    }
    assert "sensitive provider detail" not in str(exc_info.value.details)


def _provider(handler) -> DashScopeWanVideoProvider:
    return DashScopeWanVideoProvider(
        api_key="dashscope-secret",
        base_url="https://dashscope.example",
        model="wanx2.1-t2v-turbo",
        timeout_seconds=2,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
