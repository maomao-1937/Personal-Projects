from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.core.config import Settings
from app.services.database_backup import DatabaseBackupError, DatabaseBackupService


class FakeObjectStore:
    def __init__(self, content: bytes | None = None) -> None:
        self.content = content
        self.uploaded_bucket: str | None = None
        self.uploaded_key: str | None = None
        self.download_count = 0

    def upload_file(self, filename: str, bucket: str, key: str) -> None:
        self.content = Path(filename).read_bytes()
        self.uploaded_bucket = bucket
        self.uploaded_key = key

    def download_file(self, bucket: str, key: str, filename: str) -> None:
        self.download_count += 1
        if self.content is None:
            raise FileNotFoundError(key)
        Path(filename).write_bytes(self.content)


def test_from_settings_uses_explicit_database_url(tmp_path: Path) -> None:
    target = tmp_path / "runtime.db"

    service = DatabaseBackupService.from_settings(
        Settings(_env_file=None, database_url="sqlite:///ignored.db"),
        database_url=f"sqlite:///{target}",
    )

    assert service.database_path == target


def create_sqlite(path: Path, value: str = "sealed truth") -> bytes:
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE case_state (value TEXT NOT NULL)")
        connection.execute("INSERT INTO case_state (value) VALUES (?)", (value,))
    return path.read_bytes()


def test_backup_uploads_a_consistent_sqlite_snapshot(tmp_path: Path) -> None:
    database_path = tmp_path / "app.db"
    create_sqlite(database_path)
    object_store = FakeObjectStore()
    service = DatabaseBackupService(
        database_path=database_path,
        object_store=object_store,
        bucket="ai-interrogation-backup",
        object_key="db-backup/ai-interrogation.db",
    )

    assert service.backup_now() is True

    assert object_store.uploaded_bucket == "ai-interrogation-backup"
    assert object_store.uploaded_key == "db-backup/ai-interrogation.db"
    uploaded = tmp_path / "uploaded.db"
    uploaded.write_bytes(object_store.content or b"")
    with sqlite3.connect(uploaded) as connection:
        assert connection.execute("PRAGMA quick_check").fetchone() == ("ok",)
        assert connection.execute("SELECT value FROM case_state").fetchone() == (
            "sealed truth",
        )


def test_restore_downloads_atomically_when_database_is_missing(tmp_path: Path) -> None:
    source_path = tmp_path / "source.db"
    content = create_sqlite(source_path, value="restored truth")
    database_path = tmp_path / "runtime" / "app.db"
    object_store = FakeObjectStore(content)
    service = DatabaseBackupService(
        database_path=database_path,
        object_store=object_store,
        bucket="ai-interrogation-backup",
        object_key="db-backup/ai-interrogation.db",
    )

    assert service.restore_if_missing() is True

    with sqlite3.connect(database_path) as connection:
        assert connection.execute("SELECT value FROM case_state").fetchone() == (
            "restored truth",
        )


def test_restore_does_not_overwrite_an_existing_database(tmp_path: Path) -> None:
    database_path = tmp_path / "app.db"
    create_sqlite(database_path, value="local truth")
    object_store = FakeObjectStore(b"not used")
    service = DatabaseBackupService(
        database_path=database_path,
        object_store=object_store,
        bucket="ai-interrogation-backup",
        object_key="db-backup/ai-interrogation.db",
    )

    assert service.restore_if_missing() is False
    assert object_store.download_count == 0


def test_missing_remote_backup_allows_a_first_start(tmp_path: Path) -> None:
    service = DatabaseBackupService(
        database_path=tmp_path / "app.db",
        object_store=FakeObjectStore(),
        bucket="ai-interrogation-backup",
        object_key="db-backup/ai-interrogation.db",
    )

    assert service.restore_if_missing() is False
    assert service.database_path.exists() is False


def test_corrupt_remote_backup_is_rejected_without_replacing_target(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "app.db"
    service = DatabaseBackupService(
        database_path=database_path,
        object_store=FakeObjectStore(b"not-a-sqlite-database"),
        bucket="ai-interrogation-backup",
        object_key="db-backup/ai-interrogation.db",
    )

    with pytest.raises(DatabaseBackupError):
        service.restore_if_missing()

    assert database_path.exists() is False
