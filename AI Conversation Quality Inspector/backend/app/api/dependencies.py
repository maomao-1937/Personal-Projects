from dataclasses import dataclass
from typing import Annotated, Protocol, cast

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.errors import AccessTokenInvalid, BackupUnavailable, CSRFInvalid
from app.core.security import AccessContext, Security
from app.services.analysis import AnalysisService
from app.services.feedback import FeedbackService
from app.services.invites import InviteService
from app.services.quotas import QuotaService
from app.services.retention import RetentionService

ACCESS_COOKIE_NAME = "aqi_access"


@dataclass(frozen=True, slots=True)
class AuthorizedAccess:
    context: AccessContext
    remaining_uses: int


class BackupHealth(Protocol):
    def is_healthy(self, *, max_age_seconds: int) -> bool: ...


class RuntimeProtocol(Protocol):
    settings: Settings
    session_factory: sessionmaker[Session]
    security: Security
    invite_service: InviteService
    quota_service: QuotaService
    analysis_service: AnalysisService
    feedback_service: FeedbackService
    retention_service: RetentionService
    backup_service: BackupHealth | None


def get_runtime(request: Request) -> RuntimeProtocol:
    return cast(RuntimeProtocol, request.app.state.runtime)


def require_access(request: Request) -> AuthorizedAccess:
    runtime = get_runtime(request)
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not access_token:
        raise AccessTokenInvalid()
    context = runtime.security.read_access(access_token)
    access = runtime.invite_service.get_access(context.invite_id)
    return AuthorizedAccess(
        context=context,
        remaining_uses=access.remaining_uses,
    )


def require_csrf(
    request: Request,
    access: Annotated[AuthorizedAccess, Depends(require_access)],
    csrf_token: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> AuthorizedAccess:
    runtime = get_runtime(request)
    if not runtime.security.verify_csrf(access.context.csrf_token, csrf_token):
        raise CSRFInvalid()
    return access


def require_writable_access(
    request: Request,
    access: Annotated[AuthorizedAccess, Depends(require_csrf)],
) -> AuthorizedAccess:
    runtime = get_runtime(request)
    if runtime.backup_service is not None and not runtime.backup_service.is_healthy(
        max_age_seconds=runtime.settings.sqlite_backup_max_age_seconds
    ):
        raise BackupUnavailable()
    return access
