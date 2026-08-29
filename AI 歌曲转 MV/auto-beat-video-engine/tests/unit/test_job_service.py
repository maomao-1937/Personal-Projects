import pytest

from backend.domain.errors import DomainError
from backend.jobs.service import JobService
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories


@pytest.fixture
def job_service(tmp_path) -> tuple[JobService, str]:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    owner = repositories.users.create()
    project = repositories.projects.create(owner.id, "MV")
    return JobService(database), project.id


def test_create_job_is_idempotent(job_service) -> None:
    service, project_id = job_service

    first = service.create("audio_analysis", project_id, {"audio": "aud_1"}, "same-key")
    second = service.create("audio_analysis", project_id, {"audio": "aud_1"}, "same-key")

    assert first.id == second.id
    assert len(service.events(first.id)) == 1


def test_job_events_are_monotonic(job_service) -> None:
    service, project_id = job_service
    job = service.create("audio_analysis", project_id, {}, "events-key")

    service.transition(job.id, "queued", progress=0.0)
    service.transition(job.id, "running", progress=0.1)

    assert [event.sequence for event in service.events(job.id)] == [1, 2, 3]


def test_invalid_transition_does_not_change_job(job_service) -> None:
    service, project_id = job_service
    job = service.create("audio_analysis", project_id, {}, "invalid-key")

    with pytest.raises(DomainError) as caught:
        service.transition(job.id, "succeeded", progress=1.0)

    assert caught.value.code == "invalid_job_transition"
    assert service.get(job.id).status == "accepted"
    assert len(service.events(job.id)) == 1
