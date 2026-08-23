from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import sha256
from hmac import compare_digest
from hmac import new as new_hmac
from secrets import token_urlsafe

from itsdangerous import BadData, SignatureExpired, URLSafeTimedSerializer

from app.core.errors import AccessTokenExpired, AccessTokenInvalid


@dataclass(frozen=True, slots=True)
class AccessContext:
    invite_id: str
    csrf_token: str
    expires_at: datetime


class Security:
    def __init__(
        self,
        session_secret: str,
        invite_code_pepper: str,
        access_ttl_seconds: int,
    ) -> None:
        self._invite_code_pepper = invite_code_pepper.encode("utf-8")
        self._access_ttl_seconds = access_ttl_seconds
        self._serializer = URLSafeTimedSerializer(
            session_secret,
            salt="aqi-access-v1",
        )

    def digest_invite(self, raw_code: str) -> str:
        normalized_code = raw_code.strip().encode("utf-8")
        return new_hmac(
            self._invite_code_pepper,
            normalized_code,
            sha256,
        ).hexdigest()

    def issue_access(self, invite_id: str) -> tuple[str, str]:
        csrf_token = token_urlsafe(24)
        access_token = self._serializer.dumps({"v": 1, "invite_id": invite_id, "csrf": csrf_token})
        return access_token, csrf_token

    def read_access(
        self,
        access_token: str,
        *,
        max_age_seconds: int | None = None,
    ) -> AccessContext:
        max_age = self._access_ttl_seconds if max_age_seconds is None else max_age_seconds
        try:
            payload, issued_at = self._serializer.loads(
                access_token,
                max_age=max_age,
                return_timestamp=True,
            )
        except SignatureExpired as exc:
            raise AccessTokenExpired() from exc
        except BadData as exc:
            raise AccessTokenInvalid() from exc

        if not isinstance(payload, dict):
            raise AccessTokenInvalid()
        if payload.get("v") != 1:
            raise AccessTokenInvalid()

        invite_id = payload.get("invite_id")
        csrf_token = payload.get("csrf")
        if not isinstance(invite_id, str) or not invite_id:
            raise AccessTokenInvalid()
        if not isinstance(csrf_token, str) or not csrf_token:
            raise AccessTokenInvalid()
        return AccessContext(
            invite_id=invite_id,
            csrf_token=csrf_token,
            expires_at=issued_at + timedelta(seconds=self._access_ttl_seconds),
        )

    @staticmethod
    def verify_csrf(expected: str, supplied: str | None) -> bool:
        if not supplied:
            return False
        return compare_digest(expected, supplied)
