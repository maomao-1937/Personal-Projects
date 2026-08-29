from __future__ import annotations

import os
import sqlite3
import tempfile
from pathlib import Path
from threading import Lock
from typing import Protocol

import tos

from app.core.config import Settings


class DatabaseBackupError(RuntimeError):
    pass


class ObjectStore(Protocol):
    def upload_file(self, filename: str, bucket: str, key: str) -> None: ...

    def download_file(self, bucket: str, key: str, filename: str) -> None: ...


class TosObjectStore:
    def __init__(self, client: tos.TosClientV2) -> None:
        self._client = client

    @classmethod
    def from_settings(cls, settings: Settings) -> TosObjectStore:
        return cls(
            tos.TosClientV2(
                settings.tos_access_key.get_secret_value(),
                settings.tos_secret_key.get_secret_value(),
                settings.tos_endpoint,
                settings.tos_region,
                enable_crc=True,
            )
        )

    def upload_file(self, filename: str, bucket: str, key: str) -> None:
        self._client.put_object_from_file(bucket, key, filename)

    def download_file(self, bucket: str, key: str, filename: str) -> None:
        try:
            self._client.get_object_to_file(bucket, key, filename)
        except tos.exceptions.TosServerError as exc:
            if exc.status_code == 404 or exc.code in {"NoSuchKey", "NoSuchObject"}:
                raise FileNotFoundError(key) from exc
            raise


class DatabaseBackupService:
    def __init__(
        self,
        *,
        database_path: Path,
        object_store: ObjectStore | None,
        bucket: str,
        object_key: str,
        interval_seconds: int = 60,
    ) -> None:
        self.database_path = database_path
        self._object_store = object_store
        self._bucket = bucket
        self._object_key = object_key
        self.interval_seconds = interval_seconds
        self._operation_lock = Lock()

    @classmethod
    def from_settings(
        cls,
        settings: Settings,
        *,
        database_url: str | None = None,
    ) -> DatabaseBackupService:
        database_path = _sqlite_path(database_url or settings.database_url)
        object_store = TosObjectStore.from_settings(settings) if settings.tos_configured else None
        return cls(
            database_path=database_path,
            object_store=object_store,
            bucket=settings.tos_bucket,
            object_key=settings.tos_object_key,
            interval_seconds=settings.tos_backup_interval_seconds,
        )

    @property
    def configured(self) -> bool:
        return bool(
            self._object_store
            and self._bucket
            and self._object_key
            and self.database_path != Path(":memory:")
        )

    def backup_now(self) -> bool:
        if not self.configured or not self.database_path.exists():
            return False
        with self._operation_lock:
            snapshot_path = self._temporary_path("backup")
            try:
                with (
                    sqlite3.connect(self.database_path) as source,
                    sqlite3.connect(snapshot_path) as destination,
                ):
                    source.backup(destination)
                self._validate_snapshot(snapshot_path)
                assert self._object_store is not None
                self._object_store.upload_file(
                    str(snapshot_path),
                    self._bucket,
                    self._object_key,
                )
            except Exception as exc:
                if isinstance(exc, DatabaseBackupError):
                    raise
                raise DatabaseBackupError("database backup failed") from exc
            finally:
                snapshot_path.unlink(missing_ok=True)
        return True

    def restore_if_missing(self) -> bool:
        if not self.configured or self.database_path.exists():
            return False
        with self._operation_lock:
            self.database_path.parent.mkdir(parents=True, exist_ok=True)
            restore_path = self._temporary_path("restore")
            try:
                assert self._object_store is not None
                self._object_store.download_file(
                    self._bucket,
                    self._object_key,
                    str(restore_path),
                )
                self._validate_snapshot(restore_path)
                os.replace(restore_path, self.database_path)
            except FileNotFoundError:
                return False
            except Exception as exc:
                if isinstance(exc, DatabaseBackupError):
                    raise
                raise DatabaseBackupError("database restore failed") from exc
            finally:
                restore_path.unlink(missing_ok=True)
        return True

    def _temporary_path(self, operation: str) -> Path:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, raw_path = tempfile.mkstemp(
            prefix=f".{self.database_path.name}.{operation}-",
            suffix=".tmp",
            dir=self.database_path.parent,
        )
        os.close(descriptor)
        return Path(raw_path)

    @staticmethod
    def _validate_snapshot(path: Path) -> None:
        try:
            with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
                result = connection.execute("PRAGMA quick_check").fetchone()
        except sqlite3.DatabaseError as exc:
            raise DatabaseBackupError("database snapshot is invalid") from exc
        if result != ("ok",):
            raise DatabaseBackupError("database snapshot failed integrity check")


def _sqlite_path(database_url: str) -> Path:
    if not database_url.startswith("sqlite:///"):
        return Path(":memory:")
    raw_path = database_url.removeprefix("sqlite:///")
    return Path(raw_path)
