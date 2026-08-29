from __future__ import annotations

import base64
import json
import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass
from hashlib import sha256
from hmac import compare_digest, new as hmac_new
from threading import Lock
from typing import Any

from app.core.config import Settings


class AuthError(Exception):
    code = "AUTH_ERROR"
    status_code = 401
    user_message = "请重新验证访问令牌。"


class AuthRequiredError(AuthError):
    code = "AUTH_REQUIRED"
    user_message = "访问会话已失效，请重新验证。"


class InvalidAccessTokenError(AuthError):
    code = "INVALID_ACCESS_TOKEN"
    user_message = "访问令牌不正确。"


class AuthRateLimitedError(AuthError):
    code = "AUTH_RATE_LIMITED"
    status_code = 429
    user_message = "尝试次数过多，请稍后再试。"


@dataclass(frozen=True, slots=True)
class AuthIdentity:
    subject: str


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.b64decode(value + padding, altchars=b"-_", validate=True)


class AccessAuthService:
    def __init__(
        self,
        *,
        access_token_hash: str,
        signing_secret: str,
        subject: str = "shared-access",
        ttl_seconds: int = 7 * 24 * 60 * 60,
        max_failures: int = 5,
        failure_window_seconds: int = 15 * 60,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._access_token_hash = access_token_hash.strip().lower()
        self._signing_secret = signing_secret.encode("utf-8")
        self._subject = subject
        self._ttl_seconds = ttl_seconds
        self._max_failures = max_failures
        self._failure_window_seconds = failure_window_seconds
        self._clock = clock
        self._failures: defaultdict[str, deque[float]] = defaultdict(deque)
        self._failure_lock = Lock()

    @classmethod
    def from_settings(cls, settings: Settings) -> AccessAuthService:
        return cls(
            access_token_hash=settings.access_token_hash.get_secret_value(),
            signing_secret=settings.auth_signing_secret.get_secret_value(),
            subject=settings.auth_subject,
            ttl_seconds=settings.auth_session_ttl_seconds,
            max_failures=settings.auth_max_failures,
            failure_window_seconds=settings.auth_failure_window_seconds,
        )

    @property
    def configured(self) -> bool:
        return bool(self._access_token_hash and self._signing_secret and self._subject)

    def login(self, raw_token: str, source: str) -> str:
        if not self.configured:
            raise AuthRequiredError
        now = self._clock()
        source_key = source or "unknown"
        if self._is_rate_limited(source_key, now):
            raise AuthRateLimitedError

        supplied_hash = sha256(raw_token.encode("utf-8")).hexdigest()
        if not compare_digest(supplied_hash, self._access_token_hash):
            self._record_failure(source_key, now)
            raise InvalidAccessTokenError

        self._clear_failures(source_key)
        issued_at = int(now)
        payload = {
            "exp": issued_at + self._ttl_seconds,
            "iat": issued_at,
            "sub": self._subject,
            "v": 1,
        }
        payload_part = _base64url_encode(
            json.dumps(payload, ensure_ascii=True, separators=(",", ":"), sort_keys=True).encode("utf-8")
        )
        return f"{payload_part}.{self._sign(payload_part)}"

    def verify_cookie(self, value: str | None) -> AuthIdentity:
        if not self.configured or not value:
            raise AuthRequiredError
        try:
            payload_part, signature_part = value.split(".")
            expected_signature = self._sign(payload_part)
            if not compare_digest(signature_part, expected_signature):
                raise AuthRequiredError
            payload: Any = json.loads(_base64url_decode(payload_part))
            subject = payload["sub"]
            issued_at = payload["iat"]
            expires_at = payload["exp"]
            version = payload["v"]
            now = int(self._clock())
            if (
                not isinstance(subject, str)
                or not isinstance(issued_at, int)
                or not isinstance(expires_at, int)
                or version != 1
                or subject != self._subject
                or issued_at > now + 60
                or expires_at <= now
            ):
                raise AuthRequiredError
        except AuthRequiredError:
            raise
        except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AuthRequiredError from exc
        return AuthIdentity(subject=subject)

    def _sign(self, payload_part: str) -> str:
        digest = hmac_new(self._signing_secret, payload_part.encode("ascii"), sha256).digest()
        return _base64url_encode(digest)

    def _is_rate_limited(self, source: str, now: float) -> bool:
        with self._failure_lock:
            failures = self._failures[source]
            self._prune(failures, now)
            return len(failures) >= self._max_failures

    def _record_failure(self, source: str, now: float) -> None:
        with self._failure_lock:
            failures = self._failures[source]
            self._prune(failures, now)
            failures.append(now)

    def _clear_failures(self, source: str) -> None:
        with self._failure_lock:
            self._failures.pop(source, None)

    def _prune(self, failures: deque[float], now: float) -> None:
        cutoff = now - self._failure_window_seconds
        while failures and failures[0] <= cutoff:
            failures.popleft()
