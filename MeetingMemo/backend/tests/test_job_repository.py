from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.errors import DomainError
from app.jobs.models import ProcessingJob
from app.jobs.repository import JobRepository
from app.meetings.models import Meeting


def stored_meeting(session_factory, title="Repository meeting") -> Meeting:
    meeting = Meeting(title=title)
    with session_factory.begin() as session:
        session.add(meeting)
        session.flush()
        session.expunge(meeting)
    return meeting


def test_duplicate_active_job_returns_existing(session_factory):
    meeting = stored_meeting(session_factory)
    repository = JobRepository(session_factory)

    first = repository.create_or_get_summary_job(meeting.id, trace_id="trace-1")
    second = repository.create_or_get_summary_job(meeting.id, trace_id="trace-2")

    assert first.id == second.id
    with session_factory() as session:
        jobs = list(session.scalars(select(ProcessingJob)))
    assert len(jobs) == 1


def test_expired_running_lease_is_reclaimed(session_factory):
    meeting = stored_meeting(session_factory)
    repository = JobRepository(session_factory)
    job = repository.create_or_get_summary_job(meeting.id, trace_id="trace-1")
    with session_factory.begin() as session:
        stored = session.get(ProcessingJob, job.id)
        assert stored is not None
        stored.status = "running"
        stored.worker_id = "worker-1"
        stored.attempts = 1
        stored.lease_expires_at = datetime.now(UTC) - timedelta(seconds=1)

    claimed = repository.claim_next(worker_id="worker-2")

    assert claimed is not None
    assert claimed.id == job.id
    assert claimed.worker_id == "worker-2"
    assert claimed.attempts == 2
    assert claimed.status == "running"


def test_expired_job_at_attempt_limit_becomes_terminal_failure(session_factory):
    meeting = stored_meeting(session_factory)
    repository = JobRepository(session_factory)
    job = repository.create_or_get_summary_job(meeting.id, trace_id="trace-1")
    with session_factory.begin() as session:
        stored = session.get(ProcessingJob, job.id)
        assert stored is not None
        stored.status = "running"
        stored.worker_id = "worker-crashed"
        stored.attempts = stored.max_attempts
        stored.lease_expires_at = datetime.now(UTC) - timedelta(seconds=1)

    assert repository.claim_next(worker_id="worker-next") is None

    with session_factory() as session:
        exhausted = session.get(ProcessingJob, job.id)
    assert exhausted is not None
    assert exhausted.status == "failed"
    assert exhausted.error_code == "JOB_ATTEMPTS_EXHAUSTED"
    assert exhausted.worker_id is None
    with session_factory() as session:
        stored_parent = session.get(Meeting, meeting.id)
    assert stored_parent is not None
    assert stored_parent.status == "failed"


def test_lease_renewal_requires_current_worker_and_attempt(session_factory):
    meeting = stored_meeting(session_factory)
    repository = JobRepository(session_factory)
    repository.create_or_get_summary_job(meeting.id, trace_id="trace-1")
    claimed_at = datetime.now(UTC)
    claimed = repository.claim_next(
        worker_id="worker-current",
        now=claimed_at,
        lease_seconds=60,
    )
    assert claimed is not None

    renewed = repository.renew_lease(
        claimed.id,
        worker_id="worker-current",
        attempt=claimed.attempts,
        now=claimed_at + timedelta(seconds=30),
        lease_seconds=120,
    )
    rejected = repository.renew_lease(
        claimed.id,
        worker_id="worker-stale",
        attempt=claimed.attempts,
        now=claimed_at + timedelta(seconds=40),
        lease_seconds=120,
    )

    assert renewed is True
    assert rejected is False
    with session_factory() as session:
        stored = session.get(ProcessingJob, claimed.id)
    assert stored is not None
    assert stored.lease_expires_at.replace(tzinfo=UTC) == claimed_at + timedelta(seconds=150)


def test_failed_job_can_be_explicitly_retried(session_factory):
    meeting = stored_meeting(session_factory)
    repository = JobRepository(session_factory)
    job = repository.create_or_get_summary_job(meeting.id, trace_id="trace-1")
    repository.mark_failed(job.id, code="LLM_UNAVAILABLE", message="temporary")

    retried = repository.retry(job.id)

    assert retried.status == "queued"
    assert retried.error_code is None
    assert retried.error_message is None


def test_failed_job_cannot_retry_when_a_new_job_is_active(session_factory):
    meeting = stored_meeting(session_factory)
    repository = JobRepository(session_factory)
    failed = repository.create_or_get_summary_job(meeting.id, trace_id="trace-1")
    repository.mark_failed(failed.id, code="LLM_UNAVAILABLE", message="temporary")
    active = repository.create_or_get_summary_job(meeting.id, trace_id="trace-2")
    assert active.id != failed.id

    with pytest.raises(DomainError) as error:
        repository.retry(failed.id)

    assert error.value.code == "JOB_ALREADY_ACTIVE"
