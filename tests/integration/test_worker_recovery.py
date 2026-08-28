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
    assert jobs.get(job.id).status == "succeeded"


@pytest.mark.asyncio
async def test_worker_persists_structured_provider_failure(services) -> None:
    jobs, project_id = services
    job = jobs.create("audio_analysis", project_id, {}, "worker-failure", max_attempts=2)
    jobs.transition(job.id, "queued")
    registry = HandlerRegistry()

    async def handler(_):
        raise DomainError(
            "provider_rate_limited",
            "Provider is busy",
            status_code=502,
            retryable=True,
            details={"provider_status": 429},
        )

    registry.register("audio_analysis", handler)
    await JobWorker(jobs, registry, worker_id="worker-a").run_once()

    failed = jobs.get(job.id)
    assert failed.status == "failed_retryable"
    assert failed.error == {
        "code": "provider_rate_limited",
        "message": "Provider is busy",
        "retryable": True,
        "details": {"provider_status": 429},
    }
