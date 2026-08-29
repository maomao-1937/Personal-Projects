import asyncio

import pytest

from backend.domain.errors import DomainError
from backend.jobs.handlers import HandlerRegistry
from backend.jobs.recovery import RecoveryService
from backend.jobs.service import JobService
from backend.jobs.worker import JobWorker
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories


@pytest.fixture
def services(tmp_path):
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    project = repositories.projects.create(user.id, "MV")
    jobs = JobService(database)
    return jobs, project.id


@pytest.mark.asyncio
async def test_recovery_requeues_expired_local_job(services) -> None:
    jobs, project_id = services
    job = jobs.create("audio_analysis", project_id, {}, "recover-local")
    jobs.transition(job.id, "queued")
    claimed = jobs.claim_next("worker-a", lease_seconds=-1)
    assert claimed is not None and claimed.status == "running"

    recovered = await RecoveryService(jobs).run_once()

    assert recovered == 1
    assert jobs.get(job.id).status == "queued"


@pytest.mark.asyncio
async def test_recovery_resumes_remote_job_without_requeue(services) -> None:
    jobs, project_id = services
    job = jobs.create("video_generation", project_id, {}, "recover-remote")
    jobs.transition(job.id, "queued")
    claimed = jobs.claim_next("worker-a", lease_seconds=-1)
    jobs.set_provider_request_id(claimed.id, "cgt_existing")

    await RecoveryService(jobs).run_once()

    recovered = jobs.get(job.id)
    assert recovered.status == "unknown_provider_state"
    assert recovered.provider_request_id == "cgt_existing"


@pytest.mark.asyncio
async def test_worker_claims_recovered_remote_job_for_query_only_resume(services) -> None:
    jobs, project_id = services
    job = jobs.create("video_generation", project_id, {}, "resume-remote")
    jobs.transition(job.id, "queued")
    claimed = jobs.claim_next("worker-a", lease_seconds=-1)
    jobs.set_provider_request_id(claimed.id, "cgt_existing")
    await RecoveryService(jobs).run_once()
    resumed: list[str] = []
    registry = HandlerRegistry()

    async def handler(recovered_job) -> None:
        resumed.append(recovered_job.provider_request_id)

    registry.register("video_generation", handler)

    assert await JobWorker(jobs, registry, worker_id="worker-b").run_once() is True
    assert resumed == ["cgt_existing"]
    assert jobs.get(job.id).status == "succeeded"


@pytest.mark.asyncio
async def test_worker_runs_registered_handler_once(services) -> None:
    jobs, project_id = services
    job = jobs.create("audio_analysis", project_id, {}, "worker-success")
    jobs.transition(job.id, "queued")
    calls: list[str] = []
    registry = HandlerRegistry()

    async def handler(claimed_job) -> None:
        calls.append(claimed_job.id)

    registry.register("audio_analysis", handler)

    assert await JobWorker(jobs, registry, worker_id="worker-a").run_once() is True
    assert calls == [job.id]
    completed = jobs.get(job.id)
    assert completed.status == "succeeded"
    assert completed.worker_id is None
    assert completed.lease_expires_at is None


@pytest.mark.asyncio
async def test_worker_renews_lease_while_long_handler_is_running(services) -> None:
    jobs, project_id = services
    job = jobs.create("audio_analysis", project_id, {}, "worker-heartbeat")
    jobs.transition(job.id, "queued")
    registry = HandlerRegistry()

    async def handler(_) -> None:
        await asyncio.sleep(0.12)

    registry.register("audio_analysis", handler)
    worker_task = asyncio.create_task(
        JobWorker(jobs, registry, worker_id="worker-a", lease_seconds=0.06).run_once()
    )
    await asyncio.sleep(0.08)

    assert await RecoveryService(jobs).run_once() == 0
    assert jobs.get(job.id).status == "running"

    await worker_task
    assert jobs.get(job.id).status == "succeeded"


@pytest.mark.asyncio
async def test_worker_persists_structured_provider_failure(services) -> None:
    jobs, project_id = services
    job = jobs.create("audio_analysis", project_id, {}, "worker-failure", max_attempts=2)
    jobs.transition(job.id, "queued")
    registry = HandlerRegistry()

    calls = 0

    async def handler(_):
        nonlocal calls
        calls += 1
        raise DomainError(
            "provider_rate_limited",
            "Provider is busy",
            status_code=502,
            retryable=True,
            details={"provider_status": 429},
        )

    registry.register("audio_analysis", handler)
    await JobWorker(jobs, registry, worker_id="worker-a").run_once()

    retrying = jobs.get(job.id)
    assert retrying.status == "queued"
    assert retrying.attempt == 2
    assert retrying.error == {
        "code": "provider_rate_limited",
        "message": "Provider is busy",
        "retryable": True,
        "details": {"provider_status": 429},
    }

    await JobWorker(jobs, registry, worker_id="worker-b").run_once()

    failed = jobs.get(job.id)
    assert calls == 2
    assert failed.status == "failed_terminal"
    assert failed.attempt == 2


@pytest.mark.asyncio
async def test_worker_records_deadline_error_as_timed_out(services) -> None:
    jobs, project_id = services
    job = jobs.create("preview_render", project_id, {}, "render-timeout")
    jobs.transition(job.id, "queued")
    registry = HandlerRegistry()

    async def handler(_):
        raise DomainError(
            "ffmpeg_render_timed_out",
            "Render timed out",
            status_code=504,
            retryable=True,
        )

    registry.register("preview_render", handler)
    await JobWorker(jobs, registry, worker_id="worker-a").run_once()

    timed_out = jobs.get(job.id)
    assert timed_out.status == "timed_out"
    assert timed_out.finished_at is not None
    assert timed_out.worker_id is None
