from __future__ import annotations

import asyncio
import json
import secrets
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Protocol

from pydantic import BaseModel

from backend.config import FFPROBE_BIN
from backend.domain.errors import DomainError
from backend.domain.models import Job
from backend.jobs.service import JobService
from backend.persistence.database import Database
from backend.providers.video_ark import VideoTaskResult
from backend.services.projects import ProjectService
from backend.storage.local_artifacts import LocalArtifactStore


class VideoProvider(Protocol):
    def ensure_task(
        self,
        *,
        provider_request_id: str | None,
        prompt: str,
        duration_seconds: int,
        ratio: str,
        resolution: str,
    ) -> VideoTaskResult: ...

    def query(self, provider_request_id: str) -> VideoTaskResult: ...

    def download(self, video_url: str, *, max_bytes: int) -> bytes: ...


class CutAggregate(BaseModel):
    storyboard_id: str
    status: str
    total_count: int
    ready_count: int
    failed_count: int
    processing_count: int
    pending_count: int


class CutService:
    def __init__(
        self,
        database: Database,
        projects: ProjectService,
        jobs: JobService,
        *,
        max_cut_count: int,
    ) -> None:
        self.database = database
        self.projects = projects
        self.jobs = jobs
        self.max_cut_count = max_cut_count

    def aggregate(self, owner_id: str, project_id: str, storyboard_id: str) -> CutAggregate:
        self.projects.get(owner_id, project_id)
        with self.database.connect() as connection:
            storyboard = connection.execute(
                "SELECT id FROM storyboards WHERE id = ? AND project_id = ?",
                (storyboard_id, project_id),
            ).fetchone()
            if storyboard is None:
                raise DomainError("storyboard_not_found", "Storyboard 不存在。", status_code=404)
            rows = connection.execute(
                "SELECT status, active_artifact_id FROM cuts WHERE storyboard_id = ?",
                (storyboard_id,),
            ).fetchall()
        total = len(rows)
        ready = sum(row["status"] == "ready" and row["active_artifact_id"] is not None for row in rows)
        failed = sum(row["status"] == "failed" for row in rows)
        processing = sum(row["status"] in {"queued", "generating", "regenerating"} for row in rows)
        pending = total - ready - failed - processing
        if total and ready == total:
            status = "ready"
        elif ready > 0:
            status = "partial"
        elif processing > 0:
            status = "generating"
        elif failed == total and total > 0:
            status = "failed"
        else:
            status = "pending"
        return CutAggregate(
            storyboard_id=storyboard_id,
            status=status,
            total_count=total,
            ready_count=ready,
            failed_count=failed,
            processing_count=processing,
            pending_count=pending,
        )

    def generate_all(
        self,
        owner_id: str,
        project_id: str,
        storyboard_id: str,
        *,
        idempotency_key: str,
    ) -> list[Job]:
        self.projects.get(owner_id, project_id)
        with self.database.connect() as connection:
            storyboard = connection.execute(
                "SELECT status FROM storyboards WHERE id = ? AND project_id = ?",
                (storyboard_id, project_id),
            ).fetchone()
            rows = connection.execute(
                "SELECT id, status FROM cuts WHERE storyboard_id = ? ORDER BY order_index",
                (storyboard_id,),
            ).fetchall()
        if storyboard is None:
            raise DomainError("storyboard_not_found", "Storyboard 不存在。", status_code=404)
        if storyboard["status"] != "confirmed":
            raise DomainError("storyboard_not_confirmed", "请先确认 Storyboard。", status_code=409)
        if not rows or len(rows) > self.max_cut_count:
            raise DomainError("cut_count_out_of_range", "Cut 数量超出项目限制。", status_code=422)
        result: list[Job] = []
        for row in rows:
            cut_key = f"{idempotency_key}:{row['id']}"
            existing = self.jobs.get_by_idempotency_key(cut_key)
            if existing is not None:
                if existing.project_id != project_id or existing.resource_id != row["id"]:
                    raise DomainError(
                        "idempotency_conflict",
                        "该幂等键已用于不同请求。",
                        status_code=409,
                    )
                result.append(existing)
            elif row["status"] in {"pending", "failed"}:
                result.append(
                    self._queue(
                        owner_id,
                        project_id,
                        row["id"],
                        mode="retry" if row["status"] == "failed" else "generate",
                        idempotency_key=cut_key,
                    )
                )
        return result

    def generate(
        self,
        owner_id: str,
        project_id: str,
        cut_id: str,
        *,
        idempotency_key: str,
    ) -> Job:
        return self._queue(owner_id, project_id, cut_id, mode="generate", idempotency_key=idempotency_key)

    def retry(
        self,
        owner_id: str,
        project_id: str,
        cut_id: str,
        *,
        idempotency_key: str,
    ) -> Job:
        return self._queue(owner_id, project_id, cut_id, mode="retry", idempotency_key=idempotency_key)

    def regenerate(
        self,
        owner_id: str,
        project_id: str,
        cut_id: str,
        *,
        idempotency_key: str,
    ) -> Job:
        return self._queue(owner_id, project_id, cut_id, mode="regenerate", idempotency_key=idempotency_key)

    def _queue(
        self,
        owner_id: str,
        project_id: str,
        cut_id: str,
        *,
        mode: str,
        idempotency_key: str,
    ) -> Job:
        self.projects.get(owner_id, project_id)
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT cuts.*, storyboards.status AS storyboard_status
                FROM cuts JOIN storyboards ON storyboards.id = cuts.storyboard_id
                WHERE cuts.id = ? AND storyboards.project_id = ?
                """,
                (cut_id, project_id),
            ).fetchone()
        if row is None:
            raise DomainError("cut_not_found", "Cut 不存在。", status_code=404)
        if row["storyboard_status"] != "confirmed":
            raise DomainError("storyboard_not_confirmed", "请先确认 Storyboard。", status_code=409)
        existing = self.jobs.get_by_idempotency_key(idempotency_key)
        if existing is not None:
            if (
                existing.type == "cut_video_generation"
                and existing.project_id == project_id
                and existing.resource_id == cut_id
                and existing.input.get("mode") == mode
            ):
                return existing
            raise DomainError(
                "idempotency_conflict",
                "该幂等键已用于不同请求。",
                status_code=409,
            )
        allowed = {
            "generate": {"pending"},
            "retry": {"failed"},
            "regenerate": {"ready"},
        }
        if row["status"] not in allowed[mode]:
            raise DomainError(
                "cut_action_not_allowed",
                "当前 Cut 状态不允许执行该操作。",
                status_code=409,
                details={"status": row["status"], "action": mode},
            )
        spec = json.loads(row["spec_json"])
        job = self.jobs.create(
            "cut_video_generation",
            project_id,
            {
                "cut_id": cut_id,
                "mode": mode,
                "cut_version": row["cut_version"] + (1 if mode == "regenerate" else 0),
                "prompt": spec["prompt"],
                "duration_seconds": max(4, min(12, round((row["end_ms"] - row["start_ms"]) / 1000))),
                "ratio": "16:9",
                "resolution": "720p",
                "previous_active_artifact_id": row["active_artifact_id"],
            },
            idempotency_key,
            resource_type="cut",
            resource_id=cut_id,
        )
        queued = self.jobs.transition(job.id, "queued")
        with self.database.transaction() as connection:
            connection.execute(
                "UPDATE cuts SET status = ?, cut_version = ? WHERE id = ?",
                (
                    "regenerating" if mode == "regenerate" else "queued",
                    row["cut_version"] + (1 if mode == "regenerate" else 0),
                    cut_id,
                ),
            )
        return queued


class CutGenerationHandler:
    def __init__(
        self,
        database: Database,
        jobs: JobService,
        artifacts: LocalArtifactStore,
        provider: VideoProvider,
        *,
        poll_interval_seconds: float,
        max_download_bytes: int,
        video_validator: Callable[[Path], bool] | None = None,
        deadline_seconds: int = 1_200,
    ) -> None:
        self.database = database
        self.jobs = jobs
        self.artifacts = artifacts
        self.provider = provider
        self.poll_interval_seconds = poll_interval_seconds
        self.max_download_bytes = max_download_bytes
        self.video_validator = video_validator or validate_mp4
        self.deadline_seconds = deadline_seconds

    async def __call__(self, job: Job) -> None:
        cut_id = str(job.input["cut_id"])
        with self.database.connect() as connection:
            completed = connection.execute(
                "SELECT status, active_artifact_id FROM cuts WHERE id = ?",
                (cut_id,),
            ).fetchone()
        if completed and completed["status"] == "ready" and completed["active_artifact_id"]:
            self.jobs.set_result_artifact(job.id, completed["active_artifact_id"])
            return
        with self.database.transaction() as connection:
            connection.execute(
                "UPDATE cuts SET status = ? WHERE id = ?",
                ("regenerating" if job.input["mode"] == "regenerate" else "generating", cut_id),
            )
        started = time.monotonic()
        stored_path: Path | None = None
        try:
            task = await asyncio.to_thread(
                self.provider.ensure_task,
                provider_request_id=job.provider_request_id,
                prompt=str(job.input["prompt"]),
                duration_seconds=int(job.input["duration_seconds"]),
                ratio=str(job.input["ratio"]),
                resolution=str(job.input["resolution"]),
            )
            if job.provider_request_id is None:
                self.jobs.set_provider_request_id(job.id, task.provider_request_id)
            while task.status in {"submitted", "queued", "running"}:
                if time.monotonic() - started > self.deadline_seconds:
                    raise DomainError(
                        "video_generation_timed_out",
                        "单 Cut 视频生成超时。",
                        status_code=504,
                        retryable=True,
                    )
                if self.poll_interval_seconds:
                    await asyncio.sleep(self.poll_interval_seconds)
                task = await asyncio.to_thread(self.provider.query, task.provider_request_id)
            if task.status != "succeeded" or not task.video_url:
                raise DomainError(
                    "video_generation_failed",
                    "单 Cut 视频生成失败。",
                    status_code=502,
                    retryable=task.status == "expired",
                    details={"provider_status": task.raw_status, "provider_error_code": task.error_code},
                )
            video_bytes = await asyncio.to_thread(
                self.provider.download,
                task.video_url,
                max_bytes=self.max_download_bytes,
            )
            artifact_id = f"art_{secrets.token_hex(8)}"
            cut_version = int(job.input["cut_version"])
            stored = self.artifacts.put_bytes(
                f"{job.project_id}/video/{cut_id}/v{cut_version}.mp4",
                video_bytes,
            )
            stored_path = stored.path
            valid = await asyncio.to_thread(self.video_validator, stored.path)
            if not valid:
                raise DomainError(
                    "generated_video_invalid",
                    "生成结果不是可用的 MP4 视频。",
                    status_code=502,
                    retryable=True,
                )
            now = datetime.now(timezone.utc).isoformat()
            with self.database.transaction() as connection:
                connection.execute(
                    """
                    INSERT INTO artifacts(
                        id, project_id, type, storage_key, metadata_json, status, expires_at, created_at
                    ) VALUES (?, ?, 'video', ?, ?, 'ready', NULL, ?)
                    """,
                    (
                        artifact_id,
                        job.project_id,
                        stored.key,
                        json.dumps(
                            {
                                "bytes": stored.bytes,
                                "sha256": stored.sha256,
                                "provider_request_id": task.provider_request_id,
                            },
                            sort_keys=True,
                        ),
                        now,
                    ),
                )
                connection.execute(
                    "UPDATE cuts SET active_artifact_id = ?, status = 'ready' WHERE id = ?",
                    (artifact_id, cut_id),
                )
            self.jobs.set_result_artifact(job.id, artifact_id)
        except BaseException:
            if stored_path is not None:
                with self.database.connect() as connection:
                    registered = connection.execute(
                        "SELECT 1 FROM artifacts WHERE storage_key = ?",
                        (str(stored_path.relative_to(self.artifacts.root)),),
                    ).fetchone()
                if registered is None:
                    stored_path.unlink(missing_ok=True)
            with self.database.transaction() as connection:
                row = connection.execute(
                    "SELECT active_artifact_id FROM cuts WHERE id = ?", (cut_id,)
                ).fetchone()
                connection.execute(
                    "UPDATE cuts SET status = ? WHERE id = ?",
                    ("ready" if row and row["active_artifact_id"] else "failed", cut_id),
                )
            raise


def validate_mp4(path: Path) -> bool:
    process = subprocess.run(
        [
            FFPROBE_BIN,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if process.returncode != 0:
        return False
    try:
        streams = json.loads(process.stdout).get("streams", [])
    except ValueError:
        return False
    return bool(streams and streams[0].get("codec_name"))
