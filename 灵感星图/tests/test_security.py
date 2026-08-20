import socket

import httpx
import pytest

from app.security import HttpUrlFetcher, UnsafeUrlError, validate_public_url


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://127.0.0.1/admin",
        "http://10.0.0.8/secrets",
        "http://[::1]/admin",
        "http://localhost:8000/debug",
    ],
)
def test_non_public_urls_are_denied(url: str) -> None:
    with pytest.raises(UnsafeUrlError):
        validate_public_url(url)


def test_public_http_url_is_allowed_with_public_dns_result() -> None:
    def public_resolver(*_args, **_kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

    assert (
        validate_public_url("https://example.com/article", resolver=public_resolver)
        == "https://example.com/article"
    )


def test_fetcher_pins_validated_ip_and_preserves_host_and_sni() -> None:
    def public_resolver(*_args, **_kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "93.184.216.34"
        assert request.headers["host"] == "example.com"
        assert request.extensions["sni_hostname"] == "example.com"
        return httpx.Response(
            200,
            headers={"content-type": "text/plain; charset=utf-8"},
            content="public article",
        )

    fetcher = HttpUrlFetcher(
        resolver=public_resolver,
        transport=httpx.MockTransport(handler),
    )

    assert fetcher.fetch("https://example.com/article") == "public article"


def test_fetcher_stops_streaming_when_body_exceeds_limit() -> None:
    def public_resolver(*_args, **_kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

    class CountingStream(httpx.SyncByteStream):
        yielded = 0

        def __iter__(self):
            for chunk in (b"1234", b"5678", b"should-not-be-read"):
                self.yielded += 1
                yield chunk

    stream = CountingStream()

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/plain"},
            stream=stream,
        )

    fetcher = HttpUrlFetcher(
        max_bytes=5,
        resolver=public_resolver,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(UnsafeUrlError, match="size limit"):
        fetcher.fetch("https://example.com/large")

    assert stream.yielded == 2
