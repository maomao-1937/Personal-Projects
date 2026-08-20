from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse, urlunparse

import httpx


class UnsafeUrlError(ValueError):
    pass


Resolver = Callable[..., list[tuple]]


@dataclass(frozen=True)
class ResolvedPublicUrl:
    logical_url: str
    connection_url: str
    host_header: str
    sni_hostname: str


def _resolved_addresses(hostname: str, port: int, resolver: Resolver) -> set[str]:
    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        try:
            records = resolver(hostname, port, type=socket.SOCK_STREAM)
        except OSError as exc:
            raise UnsafeUrlError("URL hostname could not be resolved") from exc
        return {str(record[4][0]) for record in records}
    return {str(literal)}


def resolve_public_url(
    url: str, resolver: Resolver = socket.getaddrinfo
) -> ResolvedPublicUrl:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeUrlError("only HTTP(S) URLs are allowed")
    if not parsed.hostname:
        raise UnsafeUrlError("URL requires a hostname")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("credentials in URLs are not allowed")
    if parsed.hostname.lower() == "localhost":
        raise UnsafeUrlError("localhost URLs are not allowed")

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError as exc:
        raise UnsafeUrlError("URL has an invalid port") from exc
    addresses = _resolved_addresses(parsed.hostname, port, resolver)
    if not addresses:
        raise UnsafeUrlError("URL hostname has no addresses")
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError as exc:
            raise UnsafeUrlError("URL resolved to an invalid address") from exc
        if not ip.is_global:
            raise UnsafeUrlError("URL resolves to a non-public address")
    address = min(addresses)
    pinned_host = f"[{address}]" if ":" in address else address
    connection_netloc = f"{pinned_host}:{port}"
    connection_url = urlunparse(parsed._replace(netloc=connection_netloc))
    default_port = 443 if parsed.scheme == "https" else 80
    original_host = (
        f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
    )
    host_header = original_host if port == default_port else f"{original_host}:{port}"
    return ResolvedPublicUrl(
        logical_url=url,
        connection_url=connection_url,
        host_header=host_header,
        sni_hostname=parsed.hostname,
    )


def validate_public_url(url: str, resolver: Resolver = socket.getaddrinfo) -> str:
    return resolve_public_url(url, resolver=resolver).logical_url


class HttpUrlFetcher:
    def __init__(
        self,
        timeout_seconds: float = 15.0,
        max_bytes: int = 1_000_000,
        resolver: Resolver = socket.getaddrinfo,
        transport: httpx.BaseTransport | None = None,
    ):
        self.timeout_seconds = timeout_seconds
        self.max_bytes = max_bytes
        self.resolver = resolver
        self.transport = transport

    def fetch(self, url: str) -> str:
        current = url
        with httpx.Client(
            timeout=self.timeout_seconds,
            follow_redirects=False,
            trust_env=False,
            transport=self.transport,
        ) as client:
            for _ in range(4):
                resolved = resolve_public_url(current, resolver=self.resolver)
                headers = {
                    "User-Agent": "IncubatorBot/0.1",
                    "Host": resolved.host_header,
                }
                extensions = {"sni_hostname": resolved.sni_hostname}
                with client.stream(
                    "GET",
                    resolved.connection_url,
                    headers=headers,
                    extensions=extensions,
                ) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise UnsafeUrlError("redirect response has no location")
                        current = urljoin(current, location)
                        continue
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").lower()
                    if not any(
                        kind in content_type for kind in ("text/", "application/json")
                    ):
                        raise UnsafeUrlError("URL content type is not supported")
                    content_length = response.headers.get("content-length")
                    if content_length:
                        try:
                            declared_size = int(content_length)
                        except ValueError:
                            declared_size = 0
                        if declared_size > self.max_bytes:
                            raise UnsafeUrlError("URL content exceeds the size limit")
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > self.max_bytes:
                            raise UnsafeUrlError("URL content exceeds the size limit")
                    return bytes(content).decode(
                        response.encoding or "utf-8", errors="replace"
                    )
        raise UnsafeUrlError("too many redirects")
