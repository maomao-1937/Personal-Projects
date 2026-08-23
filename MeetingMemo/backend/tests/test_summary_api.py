from datetime import timedelta

from sqlalchemy import select

from app.jobs.models import ProcessingJob
from app.jobs.repository import JobRepository
from app.meetings.models import Meeting
from app.summaries.models import SummaryVersion


def create_meeting(auth_client, *, with_transcript: bool) -> str:
    response = auth_client.post(
        "/api/v1/meetings",
        json={"title": "Summary API meeting", "language": "zh-CN"},
    )
    assert response.status_code == 201
    meeting_id = response.json()["id"]
    if with_transcript:
        transcript = auth_client.post(
            f"/api/v1/meetings/{meeting_id}/transcript",
            json={"text": "Alice: 确认周五发布。\n\nBob: 我来准备发布清单。"},
        )
        assert transcript.status_code == 200
    return meeting_id


def test_summary_job_requires_transcript(auth_client):
    meeting_id = create_meeting(auth_client, with_transcript=False)

    response = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TRANSCRIPT_REQUIRED"


def test_duplicate_active_job_returns_same_identifier(auth_client):
    meeting_id = create_meeting(auth_client, with_transcript=True)

    first = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")
    second = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")

    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["status"] == "queued"


def test_duplicate_running_job_does_not_regress_meeting_status(app, auth_client, session_factory):
    meeting_id = create_meeting(auth_client, with_transcript=True)
    created = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs").json()
    claimed = app.state.job_runner.repository.claim_next(worker_id="worker-current")
    assert claimed is not None
    with session_factory.begin() as session:
        meeting = session.get(Meeting, meeting_id)
        assert meeting is not None
        meeting.status = "summarizing"

    duplicate = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")

    assert duplicate.status_code == 202
    assert duplicate.json()["id"] == created["id"]
    assert duplicate.json()["status"] == "running"
    assert auth_client.get(f"/api/v1/meetings/{meeting_id}").json()["status"] == "summarizing"


def test_runner_persists_summary_and_marks_job_succeeded(app, auth_client, session_factory):
    meeting_id = create_meeting(auth_client, with_transcript=True)
    created = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")
    job_id = created.json()["id"]

    assert app.state.job_runner.run_once() is True

    job = auth_client.get(f"/api/v1/jobs/{job_id}")
    meeting = auth_client.get(f"/api/v1/meetings/{meeting_id}")
    assert job.status_code == 200
    assert job.json()["status"] == "succeeded"
    assert job.json()["error"] is None
    assert meeting.json()["status"] == "ready_for_review"
    with session_factory() as session:
        summary = session.scalar(
            select(SummaryVersion).where(SummaryVersion.meeting_id == meeting_id)
        )
    assert summary is not None
    assert summary.version == 1
    assert summary.content["summary_version"] == "1.0"
    assert summary.content["decisions"][0]["source_segment_ids"]


def test_job_query_rejects_unknown_identifier(auth_client):
    response = auth_client.get("/api/v1/jobs/not-a-real-job")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "JOB_NOT_FOUND"


def test_failed_job_exposes_stable_error_without_stack(app, auth_client, monkeypatch):
    meeting_id = create_meeting(auth_client, with_transcript=True)
    created = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")
    job_id = created.json()["id"]

    def fail_pipeline(segments):
        raise RuntimeError("sensitive stack detail")

    monkeypatch.setattr(app.state.job_runner.pipeline, "run", fail_pipeline)
    assert app.state.job_runner.run_once() is True

    job = auth_client.get(f"/api/v1/jobs/{job_id}").json()
    assert job["status"] == "failed"
    assert job["error"]["code"] == "SUMMARY_JOB_FAILED"
    assert "sensitive stack detail" not in job["error"]["message"]


def test_stale_worker_cannot_persist_after_lease_is_reclaimed(app, auth_client, session_factory):
    meeting_id = create_meeting(auth_client, with_transcript=True)
    created = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs")
    repository = JobRepository(session_factory)
    stale_claim = repository.claim_next(worker_id="worker-stale", lease_seconds=1)
    assert stale_claim is not None
    reclaimed = repository.claim_next(
        worker_id="worker-current",
        now=stale_claim.lease_expires_at + timedelta(seconds=1),
    )
    assert reclaimed is not None

    app.state.job_runner._persist_success(
        stale_claim,
        {
            "summary_version": "1.0",
            "headline": "stale output",
            "topics": [],
            "decisions": [],
            "action_items": [],
            "open_questions": [],
            "quality_flags": [],
        },
        [],
    )
    app.state.job_runner._persist_failure(
        stale_claim,
        "STALE_FAILURE",
        "stale worker failure",
    )

    with session_factory() as session:
        job = session.get(ProcessingJob, created.json()["id"])
        meeting = session.get(Meeting, meeting_id)
        summary = session.scalar(
            select(SummaryVersion).where(SummaryVersion.meeting_id == meeting_id)
        )
    assert job is not None
    assert job.status == "running"
    assert job.worker_id == "worker-current"
    assert meeting is not None
    assert meeting.status == "queued"
    assert summary is None


def test_stale_worker_cannot_regress_meeting_during_segment_load(app, auth_client, session_factory):
    meeting_id = create_meeting(auth_client, with_transcript=True)
    created = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs").json()
    repository = JobRepository(session_factory)
    stale_claim = repository.claim_next(worker_id="worker-stale", lease_seconds=1)
    assert stale_claim is not None
    reclaimed = repository.claim_next(
        worker_id="worker-current",
        now=stale_claim.lease_expires_at + timedelta(seconds=1),
    )
    assert reclaimed is not None
    current_segments = app.state.job_runner._load_segments(reclaimed)
    assert current_segments
    current_summary = app.state.job_runner.pipeline.run(current_segments)
    app.state.job_runner._persist_success(
        reclaimed,
        current_summary.model_dump(mode="json"),
        current_summary.quality_flags,
    )

    stale_segments = app.state.job_runner._load_segments(stale_claim)

    assert stale_segments is None
    with session_factory() as session:
        job = session.get(ProcessingJob, created["id"])
        meeting = session.get(Meeting, meeting_id)
    assert job is not None
    assert job.status == "succeeded"
    assert meeting is not None
    assert meeting.status == "ready_for_review"


def test_runner_loop_survives_transient_repository_error(app, monkeypatch):
    runner = app.state.job_runner
    calls = 0

    def flaky_run_once():
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("temporary database fault")
        runner._stop_event.set()
        return False

    monkeypatch.setattr(runner, "run_once", flaky_run_once)

    runner._loop()

    assert calls == 2


def test_retry_updates_failed_job_and_meeting_in_one_service_transaction(
    auth_client, session_factory, monkeypatch
):
    meeting_id = create_meeting(auth_client, with_transcript=True)
    created = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs").json()
    repository = JobRepository(session_factory)
    repository.mark_failed(created["id"], code="LLM_UNAVAILABLE", message="temporary")
    with session_factory.begin() as session:
        meeting = session.get(Meeting, meeting_id)
        assert meeting is not None
        meeting.status = "failed"

    def reject_legacy_split_retry(*args, **kwargs):
        del args, kwargs
        raise AssertionError("retry must use the caller's meeting-first transaction")

    monkeypatch.setattr(JobRepository, "retry", reject_legacy_split_retry)

    response = auth_client.post(f"/api/v1/jobs/{created['id']}/retry")

    assert response.status_code == 200
    assert response.json()["status"] == "queued"
    with session_factory() as session:
        meeting = session.get(Meeting, meeting_id)
    assert meeting is not None
    assert meeting.status == "queued"


def test_failed_job_cannot_retry_after_meeting_is_deleted(auth_client, session_factory):
    meeting_id = create_meeting(auth_client, with_transcript=True)
    created = auth_client.post(f"/api/v1/meetings/{meeting_id}/summary-jobs").json()
    repository = JobRepository(session_factory)
    repository.mark_failed(created["id"], code="LLM_UNAVAILABLE", message="temporary")
    assert auth_client.delete(f"/api/v1/meetings/{meeting_id}").status_code == 204

    response = auth_client.post(f"/api/v1/jobs/{created['id']}/retry")

    assert response.status_code == 404
    with session_factory() as session:
        job = session.get(ProcessingJob, created["id"])
        meeting = session.get(Meeting, meeting_id)
    assert job is not None
    assert job.status == "failed"
    assert meeting is not None
    assert meeting.status == "archived"
