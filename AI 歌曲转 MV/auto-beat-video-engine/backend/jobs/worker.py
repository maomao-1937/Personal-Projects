from __future__ import annotations

import asyncio

from backend.domain.errors import DomainError
from backend.domain.states import JobStatus
from backend.jobs.handlers import HandlerRegistry
from backend.jobs.service import JobService


class JobWorker:
    def __init__(
        self,
        jobs: JobService,
        handlers: HandlerRegistry,
        *,
        worker_id: str,
        lease_seconds: float = 60,
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
        heartbeat = asyncio.create_task(self._heartbeat_loop(job.id))
        try:
            await handler(job)
        except DomainError as exc:
            failed = self.jobs.fail(job.id, exc)
            if failed.status == JobStatus.FAILED_RETRYABLE.value:
                self.jobs.requeue_retryable(job.id)
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
        finally:
            heartbeat.cancel()
            await asyncio.gather(heartbeat, return_exceptions=True)
        return True

    async def _heartbeat_loop(self, job_id: str) -> None:
        interval = max(self.lease_seconds / 3, 0.01)
        while True:
            await asyncio.sleep(interval)
            if not self.jobs.heartbeat(
                job_id,
                self.worker_id,
                lease_seconds=self.lease_seconds,
            ):
                return
