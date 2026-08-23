from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.access.models import AccessSession
from app.access.service import AccessService
from app.core.security import SESSION_COOKIE_NAME


def get_db_session(request: Request) -> Generator[Session]:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.close()


def get_access_service(request: Request) -> AccessService:
    return AccessService(request.app.state.settings, request.app.state.session_factory)


def require_access_session(
    request: Request,
    service: Annotated[AccessService, Depends(get_access_service)],
) -> AccessSession:
    return service.require_session(request.cookies.get(SESSION_COOKIE_NAME))
