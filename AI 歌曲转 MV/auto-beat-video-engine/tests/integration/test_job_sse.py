import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.jobs import build_jobs_router
from backend.jobs.service import JobService
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories


def _client_with_completed_job(tmp_path) -> tuple[TestClient, str]:
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    project = repositories.projects.create(user.id, "MV")
    jobs = JobService(database)
    job = jobs.create("audio_analysis", project.id, {}, "sse-job")
    jobs.transition(job.id, "queued")
    jobs.transition(job.id, "running")
    jobs.transition(job.id, "succeeded", progress=1.0)
    app = FastAPI()
    app.include_router(build_jobs_router(jobs, poll_interval_seconds=0.001))
    return TestClient(app), job.id


def test_events_endpoint_resumes_after_sequence(tmp_path) -> None:
    client, job_id = _client_with_completed_job(tmp_path)

    response = client.get(f"/api/v1/jobs/{job_id}/events?after=1")

    sequences = [item["sequence"] for item in response.json()["items"]]
    assert sequences == [2, 3, 4]


def test_sse_replays_each_persisted_event_once(tmp_path) -> None:
    client, job_id = _client_with_completed_job(tmp_path)

    response = client.get(
        f"/api/v1/jobs/{job_id}/stream?after=1",
        headers={"Last-Event-ID": "2"},
    )

    event_ids = [
        int(line.removeprefix("id: "))
        for line in response.text.splitlines()
        if line.startswith("id: ")
    ]
    data = [
        json.loads(line.removeprefix("data: "))
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    assert event_ids == [3, 4]
    assert [item["sequence"] for item in data] == [3, 4]
