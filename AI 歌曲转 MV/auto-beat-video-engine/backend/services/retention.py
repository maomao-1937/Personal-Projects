from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.persistence.database import Database
from backend.storage.local_artifacts import LocalArtifactStore


class RetentionService:
    def __init__(
        self,
        database: Database,
        artifacts: LocalArtifactStore,
        *,
        retention_days: int,
    ) -> None:
        self.database = database
        self.artifacts = artifacts
        self.retention_days = retention_days

    def purge_inactive(self, *, now: datetime | None = None) -> int:
        current = now or datetime.now(timezone.utc)
        cutoff = (current - timedelta(days=self.retention_days)).isoformat()
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT artifacts.id, artifacts.storage_key
                FROM artifacts
                JOIN projects ON projects.id = artifacts.project_id
                WHERE projects.updated_at < ? AND artifacts.status = 'ready'
                """,
                (cutoff,),
            ).fetchall()

        expired = 0
        for row in rows:
            self.artifacts.resolve(row["storage_key"]).unlink(missing_ok=True)
            with self.database.transaction() as connection:
                updated = connection.execute(
                    """
                    UPDATE artifacts
                    SET status = 'expired', expires_at = ?
                    WHERE id = ? AND status = 'ready'
                    """,
                    (current.isoformat(), row["id"]),
                ).rowcount
            expired += updated
        return expired
