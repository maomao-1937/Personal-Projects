from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class User:
    id: str
    status: str
    created_at: str


@dataclass(frozen=True, slots=True)
class Project:
    id: str
    owner_id: str
    name: str
    current_timeline_version_id: str | None
    created_at: str
    updated_at: str


@dataclass(frozen=True, slots=True)
class Job:
    id: str
    project_id: str | None
    type: str
    status: str
    resource_type: str
    resource_id: str
    input: dict[str, object]
    input_hash: str
    idempotency_key: str
    progress: float
    attempt: int
    max_attempts: int
    provider_request_id: str | None
    worker_id: str | None
    lease_expires_at: str | None
    heartbeat_at: str | None
    deadline_at: str | None
    result_artifact_id: str | None
    error: dict[str, object] | None
    created_at: str
    started_at: str | None
    finished_at: str | None


@dataclass(frozen=True, slots=True)
class JobEvent:
    job_id: str
    sequence: int
    event_type: str
    payload: dict[str, object]
    created_at: str
