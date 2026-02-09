from __future__ import annotations
import asyncio
import time
import uuid
from dataclasses import dataclass, field
from models import JobStatus


@dataclass
class JobState:
    job_id: str
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    logs: list[str] = field(default_factory=list)
    error: str | None = None
    output_file: str | None = None
    created_at: float = field(default_factory=time.time)
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)


_jobs: dict[str, JobState] = {}


def create_job() -> str:
    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = JobState(job_id=job_id)
    return job_id


def get_job(job_id: str) -> JobState | None:
    return _jobs.get(job_id)


def update_job(job_id: str, *, status: JobStatus | None = None,
               progress: float | None = None, error: str | None = None,
               output_file: str | None = None):
    job = _jobs.get(job_id)
    if not job:
        return
    if status is not None:
        job.status = status
    if progress is not None:
        job.progress = progress
    if error is not None:
        job.error = error
    if output_file is not None:
        job.output_file = output_file


def append_log(job_id: str, message: str):
    job = _jobs.get(job_id)
    if not job:
        return
    job.logs.append(message)
    try:
        job.queue.put_nowait({
            "status": job.status.value,
            "progress": job.progress,
            "log": message,
            "error": job.error,
        })
    except asyncio.QueueFull:
        pass
