from fastapi import APIRouter, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import CURRENT_SCHEMA_REVISION
from app.core.errors import DomainError

router = APIRouter(tags=["health"])


@router.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok", "service": "meetingmemo-api"}


@router.get("/health/ready")
def ready(request: Request) -> dict[str, str]:
    try:
        with request.app.state.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            if request.app.state.settings.app_env != "test":
                revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
                if revision != CURRENT_SCHEMA_REVISION:
                    raise DomainError("NOT_READY", "数据库迁移尚未完成", 503)
    except (OSError, SQLAlchemyError) as error:
        raise DomainError("NOT_READY", "数据库不可用或迁移尚未完成", 503) from error
    if request.app.state.start_runner and not request.app.state.job_runner.is_alive:
        raise DomainError("NOT_READY", "后台处理服务暂时不可用", 503)
    return {"status": "ready", "service": "meetingmemo-api"}
