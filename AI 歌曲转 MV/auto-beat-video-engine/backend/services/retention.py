from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from backend.persistence.database import Database
from backend.storage.local_artifacts import LocalArtifactStore


logger = logging.getLogger(__name__)


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
            artifact_path = self.artifacts.resolve(row["storage_key"])
            try:
                with self.database.transaction() as connection:
                    updated = connection.execute(
                        """
                        UPDATE artifacts
                        SET status = 'expired', expires_at = ?
                        WHERE id = ? AND status = 'ready'
                          AND EXISTS (
                              SELECT 1 FROM projects
                              WHERE projects.id = artifacts.project_id
                                AND projects.updated_at < ?
                          )
                        """,
                        (current.isoformat(), row["id"], cutoff),
                    ).rowcount
                    if updated:
                        artifact_path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Retention will retry artifact %s after a file operation failed", row["id"])
                continue
            expired += updated
        return expired
