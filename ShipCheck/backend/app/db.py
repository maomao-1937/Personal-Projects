"""数据库层。SQLAlchemy 2.0 + SQLite(MVP)。schema 稳定后切 Alembic 管理迁移。"""
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings, ensure_dirs

Base = declarative_base()


def _make_engine():
    ensure_dirs()
    url = settings.abs_db_url
    connect_args = (
        {"check_same_thread": False} if url.startswith("sqlite") else {}
    )
    return create_engine(url, connect_args=connect_args, future=True)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


@contextmanager
def session_scope() -> Iterator[Session]:
    """事务作用域,自动 commit/rollback/close。"""
    s = SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


def init_db() -> None:
    """MVP 用 create_all 建表。schema 稳定/上线前切 Alembic。"""
    # 确保所有模型已导入,Base.metadata 才有表
    from app.models import models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def get_db() -> Iterator[Session]:
    """FastAPI 依赖注入。"""
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def recover_jobs() -> None:
    """重启恢复:把卡在 running 的 Job 标记为 failed(interrupted)。
    ChecklistItem 已 passed 的不重跑(下次跑同 Job 跳过)。"""
    from datetime import datetime
    from app.models.models import Job, ChecklistItem
    with session_scope() as s:
        stale = s.query(Job).filter(Job.status == "running").all()
        for j in stale:
            j.status = "failed"
            j.error_message = (j.error_message or "") + " [interrupted by restart]"
            j.finished_at = datetime.utcnow()
        s.query(ChecklistItem).filter(
            ChecklistItem.status == "running"
        ).update({"status": "failed"}, synchronize_session=False)
