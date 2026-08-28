from backend.persistence.database import Database


def test_database_enables_wal_and_foreign_keys(tmp_path) -> None:
    database = Database(tmp_path / "app.db")
    database.initialize()

    with database.connect() as connection:
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_initial_migration_creates_core_tables(tmp_path) -> None:
    database = Database(tmp_path / "app.db")
    database.initialize()

    with database.connect() as connection:
        names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

    assert {
        "users",
        "projects",
        "artifacts",
        "audio_assets",
        "audio_analyses",
        "storyboards",
        "cuts",
        "jobs",
        "job_events",
        "timeline_versions",
        "previews",
        "exports",
    } <= names
