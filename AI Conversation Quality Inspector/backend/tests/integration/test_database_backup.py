import time
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import TEST_INVITE
from tests.support import VALID_TRANSCRIPT, StaticModel
from tests.unit.test_database_backup import MemoryObjectStore


def test_app_shutdown_snapshot_is_restored_before_next_start(
    test_settings,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "persistent-runtime.db"
    store = MemoryObjectStore()
    settings = test_settings.model_copy(
        update={
            "database_url": f"sqlite:///{database_path}",
            "storage_provider": "s3",
            "s3_endpoint": "https://tos-s3-cn-beijing.volces.com",
            "s3_region": "cn-beijing",
            "s3_bucket": "test-bucket",
            "s3_access_key": "test-access-key",
            "s3_secret_key": "test-secret-key",
            "sqlite_allow_bootstrap": True,
        }
    )

    first_app = create_app(settings, model_client=StaticModel(), backup_store=store)
    with TestClient(first_app, base_url="http://testserver") as first_client:
        assert store.get_bytes("conversation-qa/current.json") is not None
        access = first_client.post("/api/v1/access/redeem", json={"code": TEST_INVITE})
        csrf_token = access.json()["csrf_token"]
        analysis = first_client.post(
            "/api/v1/analyses",
            json={"qa_type": "sales", "transcript": VALID_TRANSCRIPT},
            headers={
                "Idempotency-Key": str(uuid4()),
                "X-CSRF-Token": csrf_token,
            },
        )
        assert analysis.status_code == 200
        assert analysis.json()["remaining_uses"] == 49

    database_path.unlink()
    database_path.with_name(f"{database_path.name}-wal").unlink(missing_ok=True)
    database_path.with_name(f"{database_path.name}-shm").unlink(missing_ok=True)

    restore_settings = settings.model_copy(update={"sqlite_allow_bootstrap": False})
    second_app = create_app(
        restore_settings,
        model_client=StaticModel(),
        backup_store=store,
    )
    with TestClient(second_app, base_url="http://testserver") as second_client:
        restored_access = second_client.post(
            "/api/v1/access/redeem",
            json={"code": TEST_INVITE},
        )

    assert restored_access.status_code == 200
    assert restored_access.json()["remaining_uses"] == 49


def test_vefaas_request_credentials_gate_and_initialize_runtime(
    test_settings,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "request-credentials.db"
    store = MemoryObjectStore()
    settings = test_settings.model_copy(
        update={
            "database_url": f"sqlite:///{database_path}",
            "storage_provider": "s3",
            "s3_auth_mode": "vefaas_request",
            "s3_endpoint": "https://tos-s3-cn-beijing.volces.com",
            "s3_region": "cn-beijing",
            "s3_bucket": "test-bucket",
            "s3_access_key": None,
            "s3_secret_key": None,
            "sqlite_allow_bootstrap": True,
        }
    )
    app = create_app(settings, model_client=StaticModel(), backup_store=store)
    role_headers = {
        "X-Faas-Access-Key-Id": "temporary-ak",
        "X-Faas-Secret-Access-Key": "temporary-sk",
        "X-Faas-Session-Token": "temporary-session-token",
    }

    with TestClient(app, base_url="http://testserver") as client:
        assert not database_path.exists()
        assert client.get("/health/live").status_code == 200

        gated = client.get("/health/ready")
        assert gated.status_code == 503
        assert gated.json()["error"]["code"] == "BACKUP_CREDENTIALS_UNAVAILABLE"

        ready = client.get("/health/ready", headers=role_headers)
        assert ready.status_code == 200
        assert ready.json()["database_ready"] is True
        assert ready.json()["backup_ready"] is True
        assert database_path.exists()
        assert store.get_bytes("conversation-qa/current.json") is not None

        gated_after_initialization = client.get("/api/v1/access/status")
        assert gated_after_initialization.status_code == 503
        assert (
            gated_after_initialization.json()["error"]["code"] == "BACKUP_CREDENTIALS_UNAVAILABLE"
        )

        backup_service = app.state.runtime.backup_service
        assert backup_service is not None
        backup_service._last_success_at = time.monotonic() - 1_000
        snapshots_before = len([key for key in store.objects if "/snapshots/" in key])

        redeem = client.post(
            "/api/v1/access/redeem",
            json={"code": TEST_INVITE},
            headers=role_headers,
        )
        assert redeem.status_code == 200
        assert redeem.json()["remaining_uses"] == 50
        snapshots_after = len([key for key in store.objects if "/snapshots/" in key])
        assert snapshots_after == snapshots_before + 1


def test_vefaas_runtime_initialization_failure_is_fail_closed_and_retryable(
    test_settings,
    tmp_path: Path,
) -> None:
    store = MemoryObjectStore()
    store.fail_uploads = True
    settings = test_settings.model_copy(
        update={
            "database_url": f"sqlite:///{tmp_path / 'retry.db'}",
            "storage_provider": "s3",
            "s3_auth_mode": "vefaas_request",
            "s3_endpoint": "https://tos-s3-cn-beijing.volces.com",
            "s3_region": "cn-beijing",
            "s3_bucket": "test-bucket",
            "s3_access_key": None,
            "s3_secret_key": None,
            "sqlite_allow_bootstrap": True,
        }
    )
    app = create_app(settings, model_client=StaticModel(), backup_store=store)
    role_headers = {
        "X-Faas-Access-Key-Id": "temporary-ak",
        "X-Faas-Secret-Access-Key": "temporary-sk",
        "X-Faas-Session-Token": "temporary-session-token",
    }

    with TestClient(app, base_url="http://testserver") as client:
        failed = client.get("/health/ready", headers=role_headers)
        assert failed.status_code == 503
        assert failed.json()["error"]["code"] == "BACKUP_UNAVAILABLE"

        store.fail_uploads = False
        retried = client.get("/health/ready", headers=role_headers)
        assert retried.status_code == 200
        assert retried.json()["backup_ready"] is True
