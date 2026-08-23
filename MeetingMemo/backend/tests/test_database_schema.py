from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import Engine, inspect

from alembic import command
from app.core.database import create_database_engine


@pytest.fixture
def migrated_engine(tmp_path: Path) -> Engine:
    database_url = f"sqlite:///{tmp_path / 'schema.db'}"
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")
    return create_database_engine(database_url)


def test_initial_schema_has_required_tables(migrated_engine: Engine):
    inspector = inspect(migrated_engine)

    assert {
        "invite_codes",
        "access_sessions",
        "meetings",
        "transcript_segments",
        "processing_jobs",
        "summary_versions",
        "deliveries",
        "audit_events",
        "feedback",
        "invite_rate_limit_buckets",
    } <= set(inspector.get_table_names())


def test_processing_job_has_one_active_summary_constraint(migrated_engine: Engine):
    inspector = inspect(migrated_engine)
    names = {item["name"] for item in inspector.get_indexes("processing_jobs")}

    assert "uq_active_summary_job_per_meeting" in names


def test_summary_version_is_unique_per_meeting(migrated_engine: Engine):
    inspector = inspect(migrated_engine)
    constraints = inspector.get_unique_constraints("summary_versions")
    column_sets = {tuple(item["column_names"]) for item in constraints}

    assert ("meeting_id", "version") in column_sets


def test_invite_schema_enforces_hard_redemption_limit(migrated_engine: Engine):
    inspector = inspect(migrated_engine)
    constraints = {item["name"] for item in inspector.get_check_constraints("invite_codes")}

    assert "ck_invite_codes_max_redemptions_range" in constraints
    assert "ck_invite_codes_redemption_count_range" in constraints


def test_meeting_listing_has_created_at_index(migrated_engine: Engine):
    names = {item["name"] for item in inspect(migrated_engine).get_indexes("meetings")}

    assert "ix_meetings_created_at" in names


def test_migration_can_downgrade_to_empty_schema(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'roundtrip.db'}"
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    engine = create_database_engine(database_url)

    assert inspect(engine).get_table_names() == ["alembic_version"]


def test_migration_creates_missing_sqlite_parent_directory(tmp_path: Path):
    database_path = tmp_path / "nested" / "schema.db"
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")

    command.upgrade(config, "head")

    assert database_path.is_file()
