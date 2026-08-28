from __future__ import annotations

from backend.domain.errors import DomainError
from backend.jobs.handlers import HandlerRegistry
from backend.jobs.service import JobService


class JobWorker:
    def __init__(
        self,
        jobs: JobService,
        handlers: HandlerRegistry,
        *,
        worker_id: str,
        lease_seconds: int = 60,
    ) -> None:
        self.jobs = jobs
        self.handlers = handlers
        self.worker_id = worker_id
        self.lease_seconds = lease_seconds

    async def run_once(self) -> bool:
        job = self.jobs.claim_next(self.worker_id, lease_seconds=self.lease_seconds)
        if job is None:
            return False
        handler = self.handlers.get(job.type)
        if handler is None:
            self.jobs.transition(job.id, "failed_terminal", progress=job.progress)
            return True
        try:
            await handler(job)
        except DomainError as exc:
            self.jobs.fail(job.id, exc)
        except Exception:
            self.jobs.fail(
                job.id,
                DomainError(
                    "internal_job_error",
                    "任务执行失败。",
                    status_code=500,
                    retryable=False,
                ),
            )
        else:
            if self.jobs.get(job.id).status == "running":
                self.jobs.transition(job.id, "succeeded", progress=1.0)
        return True
