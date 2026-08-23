import hashlib
import json
import sqlite3
import tempfile
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any, Protocol, cast
from uuid import uuid4

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from app.core.database import database_schema_head, known_database_revisions

EXPECTED_SCHEMA_VERSION = database_schema_head()
EXPECTED_TABLES = frozenset({"alembic_version", "invite_codes", "analysis_attempts", "feedback"})
MANIFEST_FORMAT_VERSION = 1


class DatabaseBackupError(RuntimeError):
    """Raised when a configured SQLite backup cannot be safely used."""


@dataclass(frozen=True, slots=True)
class StoredObject:
    body: bytes
    metadata: dict[str, str]


@dataclass(frozen=True, slots=True)
class SnapshotManifest:
    format_version: int
    schema_version: str
    object_key: str
    sha256: str
    size: int
    created_at: str

    def to_bytes(self) -> bytes:
        return json.dumps(asdict(self), sort_keys=True, separators=(",", ":")).encode()

    @classmethod
    def from_bytes(
        cls,
        value: bytes,
        *,
        object_prefix: str,
        allowed_schema_versions: frozenset[str],
    ) -> "SnapshotManifest":
        try:
            payload = json.loads(value)
            manifest = cls(
                format_version=int(payload["format_version"]),
                schema_version=str(payload["schema_version"]),
                object_key=str(payload["object_key"]),
                sha256=str(payload["sha256"]),
                size=int(payload["size"]),
                created_at=str(payload["created_at"]),
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise DatabaseBackupError("SQLite snapshot manifest is invalid") from exc
        expected_key_prefix = f"{object_prefix}/snapshots/"
        if (
            manifest.format_version != MANIFEST_FORMAT_VERSION
            or manifest.schema_version not in allowed_schema_versions
            or not manifest.object_key.startswith(expected_key_prefix)
            or len(manifest.sha256) != 64
            or manifest.size < 0
        ):
            raise DatabaseBackupError("SQLite snapshot manifest is invalid")
        return manifest


class ObjectStore(Protocol):
    def upload_file(self, key: str, source: Path, metadata: dict[str, str]) -> None: ...

    def download_file(self, key: str, destination: Path) -> dict[str, str] | None: ...

    def put_bytes(self, key: str, body: bytes, metadata: dict[str, str]) -> None: ...

    def get_bytes(self, key: str) -> StoredObject | None: ...


class _ReadableBody(Protocol):
    def read(self) -> bytes: ...

    def close(self) -> None: ...


class _S3Client(Protocol):
    def upload_file(
        self,
        filename: str,
        bucket: str,
        key: str,
        ExtraArgs: dict[str, Any],
    ) -> None: ...

    def download_file(self, bucket: str, key: str, filename: str) -> None: ...

    def head_object(self, *, Bucket: str, Key: str) -> dict[str, Any]: ...

    def put_object(self, **kwargs: Any) -> dict[str, Any]: ...

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, Any]: ...


class S3ObjectStore:
    """TOS-compatible S3 storage with bounded network attempts."""

    def __init__(self, *, bucket: str, client: _S3Client) -> None:
        self.bucket = bucket
        self.client = client

    @classmethod
    def create(
        cls,
        *,
        endpoint: str,
        region: str,
        bucket: str,
        access_key: str,
        secret_key: str,
        session_token: str | None = None,
    ) -> "S3ObjectStore":
        client = cast(
            _S3Client,
            boto3.client(
                "s3",
                endpoint_url=endpoint,
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                aws_session_token=session_token,
                config=Config(
                    signature_version="s3v4",
                    connect_timeout=5,
                    read_timeout=30,
                    retries={"max_attempts": 3, "mode": "standard"},
                    s3={"addressing_style": "virtual"},
                ),
            ),
        )
        return cls(bucket=bucket, client=client)

    def upload_file(self, key: str, source: Path, metadata: dict[str, str]) -> None:
        self.client.upload_file(
            str(source),
            self.bucket,
            key,
            ExtraArgs={"Metadata": metadata},
        )

    def download_file(self, key: str, destination: Path) -> dict[str, str] | None:
        try:
            self.client.download_file(self.bucket, key, str(destination))
            response = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if _is_not_found(exc):
                return None
            raise
        return _string_metadata(response.get("Metadata", {}))

    def put_bytes(self, key: str, body: bytes, metadata: dict[str, str]) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=body,
            ContentType="application/json",
            Metadata=metadata,
        )

    def get_bytes(self, key: str) -> StoredObject | None:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if _is_not_found(exc):
                return None
            raise
        response_body = cast(_ReadableBody, response["Body"])
        try:
            body = response_body.read()
        finally:
            response_body.close()
        return StoredObject(body=body, metadata=_string_metadata(response.get("Metadata", {})))


class VefaasRequestObjectStore:
    """S3 store whose short-lived credentials are refreshed from veFaaS requests."""

    def __init__(self, *, endpoint: str, region: str, bucket: str) -> None:
        self.endpoint = endpoint
        self.region = region
        self.bucket = bucket
        self._lock = Lock()
        self._credentials: tuple[str, str, str] | None = None
        self._store: S3ObjectStore | None = None

    def update_credentials(
        self,
        access_key: str,
        secret_key: str,
        session_token: str,
    ) -> None:
        credentials = (access_key.strip(), secret_key.strip(), session_token.strip())
        if not all(credentials):
            raise DatabaseBackupError("veFaaS request credentials are incomplete")
        with self._lock:
            if credentials == self._credentials:
                return
        refreshed_store = S3ObjectStore.create(
            endpoint=self.endpoint,
            region=self.region,
            bucket=self.bucket,
            access_key=credentials[0],
            secret_key=credentials[1],
            session_token=credentials[2],
        )
        with self._lock:
            if credentials != self._credentials:
                self._credentials = credentials
                self._store = refreshed_store

    def upload_file(self, key: str, source: Path, metadata: dict[str, str]) -> None:
        self._current_store().upload_file(key, source, metadata)

    def download_file(self, key: str, destination: Path) -> dict[str, str] | None:
        return self._current_store().download_file(key, destination)

    def put_bytes(self, key: str, body: bytes, metadata: dict[str, str]) -> None:
        self._current_store().put_bytes(key, body, metadata)

    def get_bytes(self, key: str) -> StoredObject | None:
        return self._current_store().get_bytes(key)

    def _current_store(self) -> S3ObjectStore:
        with self._lock:
            store = self._store
        if store is None:
            raise DatabaseBackupError("veFaaS request credentials are unavailable")
        return store


class DatabaseBackupService:
    """Publish verified immutable SQLite snapshots through an object store."""

    def __init__(
        self,
        database_url: str,
        object_store: ObjectStore,
        *,
        object_prefix: str,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.database_path = _sqlite_path(database_url)
        self.object_store = object_store
        self.object_prefix = object_prefix.strip("/")
        if not self.object_prefix:
            raise DatabaseBackupError("SQLite snapshot object prefix is empty")
        self.manifest_key = f"{self.object_prefix}/current.json"
        self._clock = clock
        self._state_lock = Lock()
        self._last_success_at: float | None = None
        self._last_error: str | None = None

    @property
    def last_error(self) -> str | None:
        with self._state_lock:
            return self._last_error

    def is_healthy(self, *, max_age_seconds: int) -> bool:
        with self._state_lock:
            last_success_at = self._last_success_at
        return last_success_at is not None and self._clock() - last_success_at <= max_age_seconds

    def restore_if_needed(self, *, allow_bootstrap: bool) -> bool:
        if self.database_path.exists():
            self._verify_snapshot(self.database_path, require_current=False)
            return False

        stored_manifest = self.object_store.get_bytes(self.manifest_key)
        if stored_manifest is None:
            if allow_bootstrap:
                return False
            raise DatabaseBackupError("Production SQLite snapshot is missing")
        manifest = SnapshotManifest.from_bytes(
            stored_manifest.body,
            object_prefix=self.object_prefix,
            allowed_schema_versions=known_database_revisions(),
        )

        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        restore_path = self._temporary_path(self.database_path.parent, "restore-")
        try:
            metadata = self.object_store.download_file(manifest.object_key, restore_path)
            if metadata is None:
                raise DatabaseBackupError("SQLite snapshot object is missing")
            self._verify_download(
                restore_path,
                manifest,
                metadata,
                require_current=False,
            )
            self._remove_sidecars()
            restore_path.replace(self.database_path)
        except DatabaseBackupError:
            raise
        except Exception as exc:
            raise DatabaseBackupError("SQLite snapshot restore failed") from exc
        finally:
            restore_path.unlink(missing_ok=True)
        return True

    def backup(self) -> SnapshotManifest:
        local_snapshot: Path | None = None
        downloaded_snapshot: Path | None = None
        try:
            if not self.database_path.is_file():
                raise DatabaseBackupError("Production SQLite database is missing")
            self.database_path.parent.mkdir(parents=True, exist_ok=True)
            local_snapshot = self._temporary_path(self.database_path.parent, "snapshot-")
            downloaded_snapshot = self._temporary_path(self.database_path.parent, "verify-")
            self._create_consistent_snapshot(local_snapshot)
            sha256 = _sha256(local_snapshot)
            created_at = datetime.now(UTC)
            object_key = (
                f"{self.object_prefix}/snapshots/"
                f"{created_at.strftime('%Y%m%dT%H%M%S.%fZ')}-{uuid4().hex}.db"
            )
            metadata = {
                "sha256": sha256,
                "schema-version": EXPECTED_SCHEMA_VERSION,
            }
            self.object_store.upload_file(object_key, local_snapshot, metadata)
            remote_metadata = self.object_store.download_file(
                object_key,
                downloaded_snapshot,
            )
            if remote_metadata is None:
                raise DatabaseBackupError("Uploaded SQLite snapshot cannot be read back")
            manifest = SnapshotManifest(
                format_version=MANIFEST_FORMAT_VERSION,
                schema_version=EXPECTED_SCHEMA_VERSION,
                object_key=object_key,
                sha256=sha256,
                size=local_snapshot.stat().st_size,
                created_at=created_at.isoformat(),
            )
            self._verify_download(
                downloaded_snapshot,
                manifest,
                remote_metadata,
                require_current=True,
            )
            manifest_body = manifest.to_bytes()
            self.object_store.put_bytes(
                self.manifest_key,
                manifest_body,
                {"schema-version": EXPECTED_SCHEMA_VERSION},
            )
            stored_manifest = self.object_store.get_bytes(self.manifest_key)
            if stored_manifest is None or stored_manifest.body != manifest_body:
                raise DatabaseBackupError("SQLite snapshot manifest cannot be read back")
            self._mark_success()
            return manifest
        except DatabaseBackupError as exc:
            self._mark_failure(exc)
            raise
        except Exception as exc:
            error = DatabaseBackupError("SQLite snapshot backup failed")
            self._mark_failure(error)
            raise error from exc
        finally:
            if local_snapshot is not None:
                local_snapshot.unlink(missing_ok=True)
            if downloaded_snapshot is not None:
                downloaded_snapshot.unlink(missing_ok=True)

    @staticmethod
    def _temporary_path(directory: Path, prefix: str) -> Path:
        with tempfile.NamedTemporaryFile(
            dir=directory,
            prefix=f".{prefix}",
            suffix=".db",
            delete=False,
        ) as handle:
            return Path(handle.name)

    def _create_consistent_snapshot(self, destination: Path) -> None:
        source_connection = sqlite3.connect(self.database_path)
        destination_connection = sqlite3.connect(destination)
        try:
            source_connection.backup(destination_connection)
        finally:
            destination_connection.close()
            source_connection.close()
        self._verify_snapshot(destination, require_current=True)

    @staticmethod
    def _verify_snapshot(path: Path, *, require_current: bool) -> str:
        try:
            connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            try:
                result = connection.execute("PRAGMA quick_check").fetchone()
                table_rows = connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
                table_names = {str(row[0]) for row in table_rows}
                revision_rows = (
                    connection.execute("SELECT version_num FROM alembic_version").fetchall()
                    if "alembic_version" in table_names
                    else []
                )
            finally:
                connection.close()
        except sqlite3.Error as exc:
            raise DatabaseBackupError("SQLite snapshot integrity check failed") from exc
        tables = {str(row[0]) for row in table_rows}
        if result != ("ok",):
            raise DatabaseBackupError("SQLite snapshot integrity check failed")
        if not EXPECTED_TABLES.issubset(tables):
            raise DatabaseBackupError("SQLite snapshot is missing required application tables")
        revisions = [str(row[0]) for row in revision_rows]
        allowed_revisions = (
            frozenset({EXPECTED_SCHEMA_VERSION}) if require_current else known_database_revisions()
        )
        if len(revisions) != 1 or revisions[0] not in allowed_revisions:
            raise DatabaseBackupError("SQLite snapshot schema revision is invalid")
        return revisions[0]

    def _verify_download(
        self,
        path: Path,
        manifest: SnapshotManifest,
        metadata: dict[str, str],
        *,
        require_current: bool,
    ) -> None:
        if path.stat().st_size != manifest.size or _sha256(path) != manifest.sha256:
            raise DatabaseBackupError("SQLite snapshot checksum verification failed")
        if metadata.get("sha256") != manifest.sha256:
            raise DatabaseBackupError("SQLite snapshot metadata verification failed")
        if metadata.get("schema-version") != manifest.schema_version:
            raise DatabaseBackupError("SQLite snapshot schema metadata is invalid")
        database_revision = self._verify_snapshot(path, require_current=require_current)
        if database_revision != manifest.schema_version:
            raise DatabaseBackupError("SQLite snapshot manifest schema is invalid")

    def _remove_sidecars(self) -> None:
        for suffix in ("-wal", "-shm"):
            self.database_path.with_name(f"{self.database_path.name}{suffix}").unlink(
                missing_ok=True
            )

    def _mark_success(self) -> None:
        with self._state_lock:
            self._last_success_at = self._clock()
            self._last_error = None

    def _mark_failure(self, error: Exception) -> None:
        with self._state_lock:
            self._last_error = type(error).__name__


def _sqlite_path(database_url: str) -> Path:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix) or database_url.endswith(":memory:"):
        raise DatabaseBackupError("SQLite file database is required for snapshot backups")
    return Path(database_url.removeprefix(prefix))


def _sha256(path: Path) -> str:
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def _string_metadata(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(key).lower(): str(item) for key, item in value.items()}


def _is_not_found(error: ClientError) -> bool:
    code = str(error.response.get("Error", {}).get("Code", ""))
    return code in {"404", "NoSuchKey", "NotFound"}
