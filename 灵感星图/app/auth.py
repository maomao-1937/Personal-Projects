from __future__ import annotations

import secrets

from fastapi import HTTPException


class StaticTokenAuth:
    """Fail-closed single-user authentication for the personal MVP."""

    def __init__(self, api_token: str | None, principal_id: str = "owner") -> None:
        self.api_token = api_token
        self.principal_id = principal_id

    def authenticate(self, authorization: str | None) -> str:
        if not self.api_token:
            raise HTTPException(
                status_code=503,
                detail="server authentication is not configured",
            )
        scheme, separator, credential = (authorization or "").partition(" ")
        if (
            not separator
            or scheme.casefold() != "bearer"
            or not secrets.compare_digest(credential, self.api_token)
        ):
            raise HTTPException(
                status_code=401,
                detail="invalid bearer token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return self.principal_id
