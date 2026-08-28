from __future__ import annotations

import json

import httpx
import pytest

from backend.domain.errors import DomainError
from backend.providers.video_ark import ArkVideoProvider


def test_create_task_returns_and_preserves_provider_request_id() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "cgt-created"})

    provider = _provider(handler)

    task = provider.ensure_task(
        provider_request_id=None,
        prompt="雨夜中的歌手，镜头缓慢推进",
        duration_seconds=5,
        ratio="16:9",
        resolution="720p",
    )

    assert task.provider_request_id == "cgt-created"
    assert task.status == "submitted"
    assert captured["method"] == "POST"
    assert captured["url"] == "https://ark.example/api/v3/contents/generations/tasks"
    assert captured["body"] == {
        "model": "seedance-model",
        "content": [{"type": "text", "text": "雨夜中的歌手，镜头缓慢推进"}],
        "ratio": "16:9",
        "duration": 5,
        "resolution": "720p",
        "watermark": False,
    }


def test_existing_provider_request_is_only_queried_never_recreated() -> None:
    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        assert request.url.path.endswith("/cgt-existing")
        return httpx.Response(
            200,
            json={
                "id": "cgt-existing",
                "status": "succeeded",
                "content": {"video_url": "https://media.example/result.mp4"},
            },
        )

    provider = _provider(handler)

    task = provider.ensure_task(
        provider_request_id="cgt-existing",
        prompt="must-not-submit",
        duration_seconds=5,
        ratio="16:9",
        resolution="720p",
    )

    assert methods == ["GET"]
    assert task.status == "succeeded"
    assert task.video_url == "https://media.example/result.mp4"


@pytest.mark.parametrize("content_type", ["text/html", "application/json", "video/webm"])
def test_download_rejects_non_mp4_content_type(content_type: str) -> None:
    provider = _provider(
        lambda _: httpx.Response(200, headers={"Content-Type": content_type}, content=b"payload")
    )

    with pytest.raises(DomainError) as exc_info:
        provider.download("https://media.example/result.mp4", max_bytes=100)

    assert exc_info.value.code == "video_download_invalid_type"


def test_download_enforces_streamed_size_limit() -> None:
    provider = _provider(
        lambda _: httpx.Response(200, headers={"Content-Type": "video/mp4"}, content=b"0123456789")
    )

    with pytest.raises(DomainError) as exc_info:
        provider.download("https://media.example/result.mp4", max_bytes=5)

    assert exc_info.value.code == "video_download_too_large"


def test_download_rejects_private_or_non_https_result_urls() -> None:
    provider = _provider(lambda _: httpx.Response(200, content=b"unused"))

    for url in ("http://media.example/result.mp4", "https://127.0.0.1/result.mp4"):
        with pytest.raises(DomainError) as exc_info:
            provider.download(url, max_bytes=100)
        assert exc_info.value.code == "video_download_url_rejected"


def _provider(handler) -> ArkVideoProvider:
    return ArkVideoProvider(
        api_key="ark-secret",
        base_url="https://ark.example/api/v3",
        model="seedance-model",
        timeout_seconds=2,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
