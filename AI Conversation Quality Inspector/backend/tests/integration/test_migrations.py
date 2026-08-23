from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def run_alembic_upgrade(database_url: str) -> None:
    ini_path = BACKEND_ROOT / "alembic.ini"
    assert ini_path.exists(), "backend/alembic.ini must exist"
    config = Config(str(ini_path))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")


def test_alembic_upgrade_creates_all_tables(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'migration.db'}"

    run_alembic_upgrade(database_url)

    inspector = inspect(create_engine(database_url))
    assert set(inspector.get_table_names()) == {
        "alembic_version",
        "analysis_attempts",
        "feedback",
        "invite_codes",
    }


def test_migration_round_trip_is_repeatable(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'round-trip.db'}"
    ini_path = BACKEND_ROOT / "alembic.ini"
    assert ini_path.exists(), "backend/alembic.ini must exist"
    config = Config(str(ini_path))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)

    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    assert "invite_codes" in inspect(create_engine(database_url)).get_table_names()
