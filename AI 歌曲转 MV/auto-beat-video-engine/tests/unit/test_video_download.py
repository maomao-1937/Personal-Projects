from __future__ import annotations

import httpx
import pytest

from backend.domain.errors import DomainError
from backend.providers.video_common import download_mp4


def test_video_download_does_not_follow_provider_redirect() -> None:
    requested: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested.append(str(request.url))
        if request.url.host == "media.example":
            return httpx.Response(302, headers={"location": "http://127.0.0.1/private"})
        return httpx.Response(200, headers={"content-type": "video/mp4"}, content=b"private")

    with httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True) as client:
        with pytest.raises(DomainError) as caught:
            download_mp4(
                client,
                "https://media.example/result.mp4",
                max_bytes=1024,
                timeout_seconds=1,
            )

    assert caught.value.code == "video_download_failed"
    assert requested == ["https://media.example/result.mp4"]


def test_video_download_keeps_direct_mp4_response() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "video/mp4"}, content=b"mp4-data")

    with httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True) as client:
        result = download_mp4(client, "https://media.example/result.mp4", max_bytes=1024, timeout_seconds=1)

    assert result == b"mp4-data"
