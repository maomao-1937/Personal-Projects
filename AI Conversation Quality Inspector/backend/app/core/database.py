from collections.abc import Generator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from sqlite3 import Connection as SQLiteConnection
from typing import cast

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from alembic import command


class Base(DeclarativeBase):
    pass


BACKEND_ROOT = Path(__file__).resolve().parents[2]


def utc_now() -> datetime:
    return datetime.now(UTC)


def create_database_engine(database_url: str) -> Engine:
    connect_args: dict[str, object] = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )

    if database_url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def set_sqlite_pragmas(dbapi_connection: object, _connection_record: object) -> None:
            cursor = cast(SQLiteConnection, dbapi_connection).cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


def run_database_migrations(database_url: str) -> None:
    config = _migration_config()
    config.set_main_option("sqlalchemy.url", database_url)
    config.attributes["database_url"] = database_url
    command.upgrade(config, "head")


def database_schema_head() -> str:
    heads = ScriptDirectory.from_config(_migration_config()).get_heads()
    if len(heads) != 1:
        raise RuntimeError("Database migration graph must have exactly one head")
    return heads[0]


def known_database_revisions() -> frozenset[str]:
    script = ScriptDirectory.from_config(_migration_config())
    return frozenset(revision.revision for revision in script.walk_revisions())


def _migration_config() -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    return config


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@contextmanager
def session_scope(factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
