from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from backend.jobs.handlers import HandlerRegistry
from backend.jobs.service import JobService
from backend.jobs.worker import JobWorker
from backend.persistence.database import Database
from backend.persistence.repositories import Repositories
from backend.providers.video_ark import VideoTaskResult
from backend.services.cuts import CutGenerationHandler, CutService
from backend.services.projects import ProjectService
from backend.storage.local_artifacts import LocalArtifactStore


class FakeVideoProvider:
    def __init__(self, outcome: str) -> None:
        self.outcome = outcome
        self.created = 0
        self.queried: list[str] = []

    def ensure_task(self, *, provider_request_id, **kwargs) -> VideoTaskResult:
        if provider_request_id:
            return self.query(provider_request_id)
        self.created += 1
        return VideoTaskResult(
            provider_request_id=f"cgt-{self.created}",
            status="submitted",
            raw_status="submitted",
        )

    def query(self, provider_request_id: str) -> VideoTaskResult:
        self.queried.append(provider_request_id)
        return VideoTaskResult(
            provider_request_id=provider_request_id,
            status=self.outcome,
            raw_status=self.outcome,
            video_url="https://media.example/cut.mp4" if self.outcome == "succeeded" else None,
            error_code="GenerationFailed" if self.outcome == "failed" else None,
        )

    def download(self, video_url: str, *, max_bytes: int) -> bytes:
        assert video_url.startswith("https://")
        return b"valid-mp4-fixture"


@pytest.fixture
def scenario(tmp_path):
    database = Database(tmp_path / "app.db")
    database.initialize()
    repositories = Repositories(database)
    user = repositories.users.create()
    project = repositories.projects.create(user.id, "MV")
    jobs = JobService(database)
    artifacts = LocalArtifactStore(tmp_path / "artifacts")
    service = CutService(
        database,
        ProjectService(repositories.projects),
        jobs,
        max_cut_count=12,
    )
    storyboard_id, cut_ids, artifact_ids = _seed_storyboard(database, project.id)
    return database, jobs, artifacts, service, user.id, project.id, storyboard_id, cut_ids, artifact_ids


def test_four_success_and_two_failures_aggregate_as_partial(scenario) -> None:
    database, _, _, service, owner_id, project_id, storyboard_id, cut_ids, artifact_ids = scenario
    with database.transaction() as connection:
        for index, cut_id in enumerate(cut_ids):
            connection.execute(
                "UPDATE cuts SET status = ?, active_artifact_id = ? WHERE id = ?",
                ("ready", artifact_ids[index], cut_id) if index < 4 else ("failed", None, cut_id),
            )

    aggregate = service.aggregate(owner_id, project_id, storyboard_id)

    assert aggregate.status == "partial"
    assert aggregate.ready_count == 4
    assert aggregate.failed_count == 2
    assert aggregate.total_count == 6


def test_failed_cut_can_retry_without_touching_successful_cuts(scenario) -> None:
    database, jobs, _, service, owner_id, project_id, _, cut_ids, artifact_ids = scenario
    with database.transaction() as connection:
        connection.execute(
            "UPDATE cuts SET status = 'ready', active_artifact_id = ? WHERE id = ?",
            (artifact_ids[0], cut_ids[0]),
        )
        connection.execute("UPDATE cuts SET status = 'failed' WHERE id = ?", (cut_ids[1],))

    job = service.retry(
        owner_id,
        project_id,
        cut_ids[1],
        idempotency_key="retry-cut-2",
    )

    assert job.status == "queued"
    assert job.resource_id == cut_ids[1]
    assert jobs.get(job.id).input["mode"] == "retry"
    with database.connect() as connection:
        successful = connection.execute(
            "SELECT status, active_artifact_id FROM cuts WHERE id = ?", (cut_ids[0],)
        ).fetchone()
    assert tuple(successful) == ("ready", artifact_ids[0])


def test_cut_action_is_idempotent_after_first_request_is_queued(scenario) -> None:
    database, _, _, service, owner_id, project_id, _, cut_ids, _ = scenario
    with database.transaction() as connection:
        connection.execute("UPDATE cuts SET status = 'failed' WHERE id = ?", (cut_ids[1],))

    first = service.retry(
        owner_id,
        project_id,
        cut_ids[1],
        idempotency_key="same-retry-request",
    )
    second = service.retry(
        owner_id,
        project_id,
        cut_ids[1],
        idempotency_key="same-retry-request",
    )

    assert second.id == first.id


def test_generate_all_replay_returns_the_same_cut_jobs(scenario) -> None:
    _, _, _, service, owner_id, project_id, storyboard_id, _, _ = scenario

    first = service.generate_all(
        owner_id,
        project_id,
        storyboard_id,
        idempotency_key="generate-all",
    )
    second = service.generate_all(
        owner_id,
        project_id,
        storyboard_id,
        idempotency_key="generate-all",
    )

    assert len(first) == 6
    assert [job.id for job in second] == [job.id for job in first]


@pytest.mark.asyncio
async def test_failed_regenerate_keeps_previous_active_artifact(scenario) -> None:
    database, jobs, artifacts, service, owner_id, project_id, _, cut_ids, artifact_ids = scenario
    cut_id = cut_ids[0]
    old_artifact_id = artifact_ids[0]
    with database.transaction() as connection:
        connection.execute(
            "UPDATE cuts SET status = 'ready', active_artifact_id = ? WHERE id = ?",
            (old_artifact_id, cut_id),
        )
    job = service.regenerate(
        owner_id,
        project_id,
        cut_id,
        idempotency_key="regenerate-cut-1",
    )
    provider = FakeVideoProvider("failed")
    registry = HandlerRegistry()
    registry.register(
        "cut_video_generation",
        CutGenerationHandler(
            database,
            jobs,
            artifacts,
            provider,
            poll_interval_seconds=0,
            max_download_bytes=1_000,
            video_validator=lambda _: True,
        ),
    )

    await JobWorker(jobs, registry, worker_id="worker-a").run_once()

    with database.connect() as connection:
        cut = connection.execute(
            "SELECT status, active_artifact_id FROM cuts WHERE id = ?", (cut_id,)
        ).fetchone()
    assert tuple(cut) == ("ready", old_artifact_id)
    assert jobs.get(job.id).status == "failed_terminal"


@pytest.mark.asyncio
async def test_successful_regenerate_validates_then_atomically_switches_artifact(scenario) -> None:
    database, jobs, artifacts, service, owner_id, project_id, _, cut_ids, artifact_ids = scenario
    cut_id = cut_ids[0]
    old_artifact_id = artifact_ids[0]
    with database.transaction() as connection:
        connection.execute(
            "UPDATE cuts SET status = 'ready', active_artifact_id = ? WHERE id = ?",
            (old_artifact_id, cut_id),
        )
    job = service.regenerate(
        owner_id,
        project_id,
        cut_id,
        idempotency_key="regenerate-success",
    )
    provider = FakeVideoProvider("succeeded")
    registry = HandlerRegistry()
    registry.register(
        "cut_video_generation",
        CutGenerationHandler(
            database,
            jobs,
            artifacts,
            provider,
            poll_interval_seconds=0,
            max_download_bytes=1_000,
            video_validator=lambda path: path.read_bytes() == b"valid-mp4-fixture",
        ),
    )

    await JobWorker(jobs, registry, worker_id="worker-a").run_once()

    with database.connect() as connection:
        cut = connection.execute(
            "SELECT status, active_artifact_id FROM cuts WHERE id = ?", (cut_id,)
        ).fetchone()
        artifact = connection.execute(
            "SELECT status, type FROM artifacts WHERE id = ?", (cut["active_artifact_id"],)
        ).fetchone()
    assert cut["status"] == "ready"
    assert cut["active_artifact_id"] != old_artifact_id
    assert tuple(artifact) == ("ready", "video")
    assert jobs.get(job.id).status == "succeeded"
    assert provider.created == 1
    assert provider.queried == ["cgt-1"]


def _seed_storyboard(database: Database, project_id: str) -> tuple[str, list[str], list[str]]:
    now = datetime.now(timezone.utc).isoformat()
    storyboard_id = "stb_1"
    cut_ids = [f"cut_{index}" for index in range(6)]
    artifact_ids = [f"art_old_{index}" for index in range(6)]
    with database.transaction() as connection:
        connection.execute(
            "INSERT INTO storyboards VALUES (?, ?, ?, ?, ?, ?, ?)",
            (storyboard_id, project_id, 1, json.dumps({"plot": {}}), "confirmed", None, now),
        )
        for index, (cut_id, artifact_id) in enumerate(zip(cut_ids, artifact_ids, strict=True)):
            connection.execute(
                "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (artifact_id, project_id, "video", f"old/{index}.mp4", "{}", "ready", None, now),
            )
            connection.execute(
                "INSERT INTO cuts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    cut_id,
                    storyboard_id,
                    1,
                    index,
                    index * 5_000,
                    (index + 1) * 5_000,
                    json.dumps(
                        {
                            "prompt": f"镜头 {index + 1}",
                            "mood": "坚定",
                            "camera": "推进",
                            "action": "奔跑",
                        }
                    ),
                    None,
                    "pending",
                    now,
                ),
            )
    return storyboard_id, cut_ids, artifact_ids
