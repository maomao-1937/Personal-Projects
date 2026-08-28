from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone

from backend.domain.errors import DomainError
from backend.domain.models import Job, JobEvent
from backend.domain.states import JobStatus, can_transition
from backend.persistence.database import Database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class JobService:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create(
        self,
        job_type: str,
        project_id: str | None,
        input_data: dict[str, object],
        idempotency_key: str,
        *,
        resource_type: str = "project",
        resource_id: str | None = None,
        max_attempts: int = 1,
    ) -> Job:
        input_json = _canonical_json(input_data)
        input_hash = hashlib.sha256(input_json.encode("utf-8")).hexdigest()
        with self.database.transaction() as connection:
            existing = connection.execute(
                "SELECT * FROM jobs WHERE idempotency_key = ?",
                (idempotency_key,),
            ).fetchone()
            if existing is not None:
                if existing["input_hash"] != input_hash or existing["type"] != job_type:
                    raise DomainError(
                        code="idempotency_conflict",
                        message="该幂等键已用于不同请求。",
                        status_code=409,
                    )
                return _job_from_row(existing)

            job_id = f"job_{secrets.token_hex(8)}"
            created_at = _now()
            resolved_resource_id = resource_id or project_id or job_id
            connection.execute(
                """
                INSERT INTO jobs(
                    id, project_id, type, status, resource_type, resource_id,
                    input_json, input_hash, idempotency_key, progress,
                    attempt, max_attempts, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    project_id,
                    job_type,
                    JobStatus.ACCEPTED.value,
                    resource_type,
                    resolved_resource_id,
                    input_json,
                    input_hash,
                    idempotency_key,
                    0.0,
                    1,
                    max_attempts,
                    created_at,
                ),
            )
            self._append_event(
                connection,
                job_id,
                "status_changed",
                {"status": JobStatus.ACCEPTED.value, "progress": 0.0},
                created_at,
            )
            row = connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _job_from_row(row)

    def get(self, job_id: str) -> Job:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row is None:
            raise DomainError("job_not_found", "任务不存在。", status_code=404)
        return _job_from_row(row)

    def transition(self, job_id: str, target: str, *, progress: float | None = None) -> Job:
        with self.database.transaction() as connection:
            row = connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if row is None:
                raise DomainError("job_not_found", "任务不存在。", status_code=404)
            if not can_transition(row["status"], target):
                raise DomainError(
                    code="invalid_job_transition",
                    message=f"任务不能从 {row['status']} 变为 {target}。",
                    status_code=409,
                    details={"current": row["status"], "target": target},
                )
            resolved_progress = row["progress"] if progress is None else progress
            now = _now()
            started_at = now if target == JobStatus.RUNNING.value and row["started_at"] is None else row["started_at"]
            finished_at = now if target in {
                JobStatus.SUCCEEDED.value,
                JobStatus.FAILED_TERMINAL.value,
                JobStatus.TIMED_OUT.value,
                JobStatus.CANCELLED.value,
            } else None
            connection.execute(
                """
                UPDATE jobs SET status = ?, progress = ?, started_at = ?, finished_at = ?
                WHERE id = ?
                """,
                (target, resolved_progress, started_at, finished_at, job_id),
            )
            self._append_event(
                connection,
                job_id,
                "status_changed",
                {"status": target, "progress": resolved_progress},
                now,
            )
            updated = connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _job_from_row(updated)

    def events(self, job_id: str, *, after: int = 0) -> list[JobEvent]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM job_events
                WHERE job_id = ? AND sequence > ?
                ORDER BY sequence ASC
                """,
                (job_id, after),
            ).fetchall()
        return [_event_from_row(row) for row in rows]

    def claim_next(self, worker_id: str, *, lease_seconds: int = 60) -> Job | None:
        now = datetime.now(timezone.utc)
        lease_expires_at = (now + timedelta(seconds=lease_seconds)).isoformat()
        with self.database.transaction() as connection:
            row = connection.execute(
                "SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC LIMIT 1",
                (JobStatus.QUEUED.value,),
            ).fetchone()
            if row is None:
                return None
            updated = connection.execute(
                """
                UPDATE jobs
                SET status = ?, worker_id = ?, lease_expires_at = ?, heartbeat_at = ?,
                    started_at = COALESCE(started_at, ?)
                WHERE id = ? AND status = ?
                """,
                (
                    JobStatus.RUNNING.value,
                    worker_id,
                    lease_expires_at,
                    now.isoformat(),
                    now.isoformat(),
                    row["id"],
                    JobStatus.QUEUED.value,
                ),
            ).rowcount
            if updated != 1:
                return None
            self._append_event(
                connection,
                row["id"],
                "status_changed",
                {"status": JobStatus.RUNNING.value, "progress": row["progress"]},
                now.isoformat(),
            )
            claimed = connection.execute("SELECT * FROM jobs WHERE id = ?", (row["id"],)).fetchone()
        return _job_from_row(claimed)

    def set_provider_request_id(self, job_id: str, provider_request_id: str) -> Job:
        with self.database.transaction() as connection:
            updated = connection.execute(
                "UPDATE jobs SET provider_request_id = ? WHERE id = ?",
                (provider_request_id, job_id),
            ).rowcount
            if updated != 1:
                raise DomainError("job_not_found", "任务不存在。", status_code=404)
            row = connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _job_from_row(row)

    def recover_expired(self) -> int:
        now = _now()
        recovered = 0
        with self.database.transaction() as connection:
            rows = connection.execute(
                """
                SELECT * FROM jobs
                WHERE status = ? AND lease_expires_at IS NOT NULL AND lease_expires_at < ?
                """,
                (JobStatus.RUNNING.value, now),
            ).fetchall()
            for row in rows:
                target = (
                    JobStatus.UNKNOWN_PROVIDER_STATE.value
                    if row["provider_request_id"]
                    else JobStatus.QUEUED.value
                )
                connection.execute(
                    """
                    UPDATE jobs
                    SET status = ?, worker_id = NULL, lease_expires_at = NULL, heartbeat_at = NULL
                    WHERE id = ?
                    """,
                    (target, row["id"]),
                )
                self._append_event(
                    connection,
                    row["id"],
                    "job_recovered",
                    {"status": target, "progress": row["progress"]},
                    now,
                )
                recovered += 1
        return recovered

    @staticmethod
    def _append_event(connection, job_id: str, event_type: str, payload: dict[str, object], created_at: str) -> None:
        sequence = connection.execute(
            "SELECT COALESCE(MAX(sequence), 0) + 1 FROM job_events WHERE job_id = ?",
            (job_id,),
        ).fetchone()[0]
        connection.execute(
            """
            INSERT INTO job_events(job_id, sequence, event_type, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (job_id, sequence, event_type, _canonical_json(payload), created_at),
        )


def _job_from_row(row) -> Job:
    return Job(
        id=row["id"],
        project_id=row["project_id"],
        type=row["type"],
        status=row["status"],
        resource_type=row["resource_type"],
        resource_id=row["resource_id"],
        input=json.loads(row["input_json"]),
        input_hash=row["input_hash"],
        idempotency_key=row["idempotency_key"],
        progress=row["progress"],
        attempt=row["attempt"],
        max_attempts=row["max_attempts"],
        provider_request_id=row["provider_request_id"],
        worker_id=row["worker_id"],
        lease_expires_at=row["lease_expires_at"],
        heartbeat_at=row["heartbeat_at"],
        deadline_at=row["deadline_at"],
        result_artifact_id=row["result_artifact_id"],
        error=json.loads(row["error_json"]) if row["error_json"] else None,
        created_at=row["created_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
    )


def _event_from_row(row) -> JobEvent:
    return JobEvent(
        job_id=row["job_id"],
        sequence=row["sequence"],
        event_type=row["event_type"],
        payload=json.loads(row["payload_json"]),
        created_at=row["created_at"],
    )
