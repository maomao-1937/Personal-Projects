from datetime import datetime, timedelta, timezone

from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.services.retention import RetentionService
from backend.storage.local_artifacts import LocalArtifactStore


def test_retention_expires_only_assets_for_projects_inactive_over_30_days(tmp_path) -> None:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    old_project = repositories.projects.create(user.id, "Old")
    active_project = repositories.projects.create(user.id, "Active")
    artifacts = LocalArtifactStore(tmp_path / "artifacts")
    old_file = artifacts.put_bytes(f"{old_project.id}/old.mp4", b"old")
    active_file = artifacts.put_bytes(f"{active_project.id}/active.mp4", b"active")
    now = datetime.now(timezone.utc)
    with database.transaction() as connection:
        connection.execute(
            "UPDATE projects SET updated_at = ? WHERE id = ?",
            ((now - timedelta(days=31)).isoformat(), old_project.id),
        )
        connection.execute(
            "INSERT INTO artifacts VALUES (?, ?, 'video', ?, '{}', 'ready', NULL, ?)",
            ("art_old", old_project.id, old_file.key, now.isoformat()),
        )
        connection.execute(
            "INSERT INTO artifacts VALUES (?, ?, 'video', ?, '{}', 'ready', NULL, ?)",
            ("art_active", active_project.id, active_file.key, now.isoformat()),
        )

    expired = RetentionService(database, artifacts, retention_days=30).purge_inactive(now=now)

    assert expired == 1
    assert not old_file.path.exists()
    assert active_file.path.exists()
    with database.connect() as connection:
        assert connection.execute(
            "SELECT status FROM artifacts WHERE id = 'art_old'"
        ).fetchone()[0] == "expired"
        assert connection.execute(
            "SELECT status FROM artifacts WHERE id = 'art_active'"
        ).fetchone()[0] == "ready"
