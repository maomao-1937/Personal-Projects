from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.database import ensure_sqlite_parent


def run_migrations(database_url: str) -> None:
    ensure_sqlite_parent(database_url)
    backend_root = Path(__file__).resolve().parents[2]
    config = Config()
    config.set_main_option("script_location", str(backend_root / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    config.attributes["explicit_database_url"] = True
    command.upgrade(config, "head")
