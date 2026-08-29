from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def ensure_sqlite_parent(database_url: str) -> None:
    if not database_url.startswith("sqlite:///") or database_url.endswith(":memory:"):
        return
    raw_path = database_url.removeprefix("sqlite:///")
    path = Path(raw_path)
    path.parent.mkdir(parents=True, exist_ok=True)


class Base(DeclarativeBase):
    pass


class Database:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        self.engine = create_engine(database_url, connect_args=connect_args)
        self.session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )

    def create_schema(self) -> None:
        from app.repositories.cases import CaseRecord  # noqa: F401
        from app.repositories.sessions import SessionRecord  # noqa: F401

        Base.metadata.create_all(self.engine)

    @contextmanager
    def session(self) -> Iterator[Session]:
        db_session = self.session_factory()
        try:
            yield db_session
            db_session.commit()
        except Exception:
            db_session.rollback()
            raise
        finally:
            db_session.close()
