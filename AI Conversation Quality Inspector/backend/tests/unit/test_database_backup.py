import hashlib
import json
import sqlite3
from pathlib import Path

import pytest
from botocore.exceptions import ClientError

import app.services.database_backup as backup_module
from app.core.database import run_database_migrations
from app.services.database_backup import (
    EXPECTED_SCHEMA_VERSION,
    DatabaseBackupError,
    DatabaseBackupService,
    S3ObjectStore,
    StoredObject,
    VefaasRequestObjectStore,
)


class MemoryObjectStore:
    def __init__(self) -> None:
        self.objects: dict[str, StoredObject] = {}
        self.fail_uploads = False

    def upload_file(self, key: str, source: Path, metadata: dict[str, str]) -> None:
        if self.fail_uploads:
            raise OSError("object store unavailable")
        self.objects[key] = StoredObject(source.read_bytes(), metadata)

    def download_file(self, key: str, destination: Path) -> dict[str, str] | None:
        stored = self.objects.get(key)
        if stored is None:
            return None
        destination.write_bytes(stored.body)
        return stored.metadata

    def put_bytes(self, key: str, body: bytes, metadata: dict[str, str]) -> None:
        if self.fail_uploads:
            raise OSError("object store unavailable")
        self.objects[key] = StoredObject(body, metadata)

    def get_bytes(self, key: str) -> StoredObject | None:
        return self.objects.get(key)


class FakeReadableBody:
    def __init__(self, body: bytes) -> None:
        self.body = body
        self.closed = False

    def read(self) -> bytes:
        return self.body

    def close(self) -> None:
        self.closed = True


class FakeS3Client:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, dict[str, str]]] = {}
        self.last_body: FakeReadableBody | None = None

    def upload_file(
        self,
        filename: str,
        bucket: str,
        key: str,
        ExtraArgs: dict,
    ) -> None:
        self.objects[key] = (Path(filename).read_bytes(), ExtraArgs["Metadata"])

    def download_file(self, bucket: str, key: str, filename: str) -> None:
        if key not in self.objects:
            raise _not_found_error()
        Path(filename).write_bytes(self.objects[key][0])

    def head_object(self, *, Bucket: str, Key: str) -> dict:
        return {"Metadata": self.objects[Key][1]}

    def put_object(self, **kwargs) -> dict:
        self.objects[kwargs["Key"]] = (kwargs["Body"], kwargs["Metadata"])
        return {}

    def get_object(self, *, Bucket: str, Key: str) -> dict:
        if Key not in self.objects:
            raise _not_found_error()
        body, metadata = self.objects[Key]
        self.last_body = FakeReadableBody(body)
        return {"Body": self.last_body, "Metadata": metadata}


def _not_found_error() -> ClientError:
    return ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "missing"}},
        "GetObject",
    )


def _database_url(path: Path) -> str:
    return f"sqlite:///{path}"


def _create_app_database(path: Path, value: int = 41) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    run_database_migrations(_database_url(path))
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("CREATE TABLE backup_probe (value INTEGER NOT NULL)")
    connection.execute("INSERT INTO backup_probe VALUES (?)", (value,))
    connection.commit()
    return connection


def _service(
    database_path: Path,
    store: MemoryObjectStore,
    *,
    clock=lambda: 100.0,
) -> DatabaseBackupService:
    return DatabaseBackupService(
        _database_url(database_path),
        store,
        object_prefix="conversation-qa",
        clock=clock,
    )


def test_versioned_backup_and_restore_preserve_committed_wal_data(tmp_path: Path) -> None:
    database_path = tmp_path / "runtime" / "app.db"
    store = MemoryObjectStore()
    connection = _create_app_database(database_path)
    service = _service(database_path, store)

    manifest = service.backup()
    connection.close()

    assert manifest.object_key.startswith("conversation-qa/snapshots/")
    assert manifest.schema_version == EXPECTED_SCHEMA_VERSION
    assert store.get_bytes("conversation-qa/current.json") is not None

    database_path.unlink()
    database_path.with_name("app.db-wal").write_bytes(b"stale-wal")
    database_path.with_name("app.db-shm").write_bytes(b"stale-shm")

    assert service.restore_if_needed(allow_bootstrap=False) is True
    restored = sqlite3.connect(database_path)
    try:
        value = restored.execute("SELECT value FROM backup_probe").fetchone()
    finally:
        restored.close()

    assert value == (41,)
    assert not database_path.with_name("app.db-wal").exists()
    assert not database_path.with_name("app.db-shm").exists()


def test_missing_snapshot_fails_closed_without_explicit_bootstrap(tmp_path: Path) -> None:
    database_path = tmp_path / "app.db"
    service = _service(database_path, MemoryObjectStore())

    with pytest.raises(DatabaseBackupError, match="snapshot is missing"):
        service.restore_if_needed(allow_bootstrap=False)

    assert service.restore_if_needed(allow_bootstrap=True) is False


def test_restore_rejects_empty_sqlite_even_with_matching_checksum(tmp_path: Path) -> None:
    database_path = tmp_path / "runtime" / "app.db"
    store = MemoryObjectStore()
    service = _service(database_path, store)
    empty_digest = hashlib.sha256(b"").hexdigest()
    object_key = "conversation-qa/snapshots/empty.db"
    store.objects[object_key] = StoredObject(
        b"",
        {
            "sha256": empty_digest,
            "schema-version": EXPECTED_SCHEMA_VERSION,
        },
    )
    manifest = {
        "format_version": 1,
        "schema_version": EXPECTED_SCHEMA_VERSION,
        "object_key": object_key,
        "sha256": empty_digest,
        "size": 0,
        "created_at": "2026-08-22T00:00:00+00:00",
    }
    store.objects["conversation-qa/current.json"] = StoredObject(
        json.dumps(manifest).encode(),
        {},
    )

    with pytest.raises(DatabaseBackupError, match="required application tables"):
        service.restore_if_needed(allow_bootstrap=False)

    assert not database_path.exists()


def test_existing_invalid_database_is_not_silently_bootstrapped(tmp_path: Path) -> None:
    database_path = tmp_path / "app.db"
    database_path.write_bytes(b"")
    service = _service(database_path, MemoryObjectStore())

    with pytest.raises(DatabaseBackupError, match="required application tables"):
        service.restore_if_needed(allow_bootstrap=True)


def test_backup_rejects_database_with_wrong_alembic_revision(tmp_path: Path) -> None:
    database_path = tmp_path / "app.db"
    connection = _create_app_database(database_path)
    connection.execute("UPDATE alembic_version SET version_num = 'wrong_revision'")
    connection.commit()
    service = _service(database_path, MemoryObjectStore())

    with pytest.raises(DatabaseBackupError, match="schema revision"):
        service.backup()

    connection.close()


def test_restore_accepts_known_ancestor_before_migration(
    tmp_path: Path,
    monkeypatch,
) -> None:
    database_path = tmp_path / "app.db"
    connection = _create_app_database(database_path)
    connection.execute("UPDATE alembic_version SET version_num = 'known_ancestor'")
    connection.commit()
    service = _service(database_path, MemoryObjectStore())
    monkeypatch.setattr(
        backup_module,
        "known_database_revisions",
        lambda: frozenset({EXPECTED_SCHEMA_VERSION, "known_ancestor"}),
    )

    assert service.restore_if_needed(allow_bootstrap=False) is False
    with pytest.raises(DatabaseBackupError, match="schema revision"):
        service.backup()

    connection.close()


def test_backup_health_expires_after_rpo_and_records_failures(tmp_path: Path) -> None:
    database_path = tmp_path / "app.db"
    store = MemoryObjectStore()
    connection = _create_app_database(database_path)
    now = [100.0]
    service = _service(database_path, store, clock=lambda: now[0])

    service.backup()
    assert service.is_healthy(max_age_seconds=600) is True

    now[0] = 701.0
    assert service.is_healthy(max_age_seconds=600) is False
    store.fail_uploads = True
    with pytest.raises(DatabaseBackupError, match="backup failed"):
        service.backup()
    assert service.last_error is not None
    connection.close()


def test_s3_object_store_upload_download_pointer_and_not_found(tmp_path: Path) -> None:
    client = FakeS3Client()
    store = S3ObjectStore(bucket="test-bucket", client=client)
    source = tmp_path / "source.db"
    destination = tmp_path / "download.db"
    source.write_bytes(b"snapshot")

    store.upload_file("snapshots/one.db", source, {"SHA256": "digest"})
    metadata = store.download_file("snapshots/one.db", destination)
    store.put_bytes("current.json", b"{}", {"schema-version": "one"})
    current = store.get_bytes("current.json")

    assert destination.read_bytes() == b"snapshot"
    assert metadata == {"sha256": "digest"}
    assert current == StoredObject(b"{}", {"schema-version": "one"})
    assert client.last_body is not None and client.last_body.closed is True
    assert store.download_file("missing.db", destination) is None
    assert store.get_bytes("missing.json") is None


def test_s3_object_store_create_uses_bounded_virtual_host_config(monkeypatch) -> None:
    captured: dict = {}
    client = FakeS3Client()

    def fake_client(service_name: str, **kwargs):
        captured["service_name"] = service_name
        captured.update(kwargs)
        return client

    monkeypatch.setattr(backup_module.boto3, "client", fake_client)

    store = S3ObjectStore.create(
        endpoint="https://tos-s3-cn-beijing.volces.com",
        region="cn-beijing",
        bucket="test-bucket",
        access_key="access-key",
        secret_key="secret-key",
    )

    config = captured["config"]
    assert store.client is client
    assert captured["service_name"] == "s3"
    assert config.signature_version == "s3v4"
    assert config.connect_timeout == 5
    assert config.read_timeout == 30
    assert config.s3["addressing_style"] == "virtual"


def test_vefaas_request_store_rotates_temporary_credentials(monkeypatch, tmp_path: Path) -> None:
    captured: list[dict] = []
    clients = [FakeS3Client(), FakeS3Client()]

    def fake_client(service_name: str, **kwargs):
        captured.append({"service_name": service_name, **kwargs})
        return clients[len(captured) - 1]

    monkeypatch.setattr(backup_module.boto3, "client", fake_client)
    store = VefaasRequestObjectStore(
        endpoint="https://tos-s3-cn-beijing.volces.com",
        region="cn-beijing",
        bucket="test-bucket",
    )

    with pytest.raises(DatabaseBackupError, match="credentials are unavailable"):
        store.get_bytes("current.json")
    with pytest.raises(DatabaseBackupError, match="credentials are incomplete"):
        store.update_credentials("temporary-ak", "", "session-one")

    store.update_credentials("temporary-ak", "temporary-sk", "session-one")
    store.update_credentials("temporary-ak", "temporary-sk", "session-one")
    source = tmp_path / "snapshot.db"
    destination = tmp_path / "download.db"
    source.write_bytes(b"snapshot")
    store.upload_file("snapshot.db", source, {"sha256": "digest"})
    metadata = store.download_file("snapshot.db", destination)
    store.put_bytes("current.json", b"{}", {"schema-version": "one"})
    current = store.get_bytes("current.json")
    store.update_credentials("temporary-ak", "temporary-sk", "session-two")

    assert len(captured) == 2
    assert captured[0]["aws_session_token"] == "session-one"
    assert captured[1]["aws_session_token"] == "session-two"
    assert clients[0].objects["snapshot.db"][0] == b"snapshot"
    assert destination.read_bytes() == b"snapshot"
    assert metadata == {"sha256": "digest"}
    assert current == StoredObject(b"{}", {"schema-version": "one"})
