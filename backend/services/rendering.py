from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
from datetime import datetime, timezone

from pydantic import BaseModel

from backend.domain.errors import DomainError
from backend.domain.models import Job
from backend.jobs.service import JobService
from backend.persistence.database import Database
from backend.providers.render_ffmpeg import FFmpegRenderProvider, RenderCut
from backend.services.projects import ProjectService
from backend.services.timelines import TimelineService
from backend.storage.local_artifacts import LocalArtifactStore


class PreviewRecord(BaseModel):
    id: str
    project_id: str
    timeline_version_id: str
    completeness: str
    status: str
    job_id: str
    artifact_id: str | None = None
    stale_reason: str | None = None


class RenderingService:
    def __init__(
        self,
        database: Database,
        projects: ProjectService,
        timelines: TimelineService,
        jobs: JobService,
    ) -> None:
        self.database = database
        self.projects = projects
        self.timelines = timelines
        self.jobs = jobs

    def create_preview(
        self,
        owner_id: str,
        project_id: str,
        *,
        idempotency_key: str,
    ) -> PreviewRecord:
        self.projects.get(owner_id, project_id)
        existing_job = self.jobs.get_by_idempotency_key(idempotency_key)
        if existing_job is not None:
            if existing_job.project_id != project_id or existing_job.type != "preview_render":
                raise DomainError("idempotency_conflict", "该幂等键已用于不同请求。", status_code=409)
            return self._preview_for_job(existing_job.id)

        timeline = self.timelines.build_current(owner_id, project_id)
        with self.database.connect() as connection:
            existing = connection.execute(
                """
                SELECT * FROM previews
                WHERE project_id = ? AND timeline_version_id = ? AND status IN ('queued', 'rendering', 'ready')
                ORDER BY created_at DESC LIMIT 1
                """,
                (project_id, timeline.id),
            ).fetchone()
        if existing is not None:
            return _preview_from_row(existing)

        cuts = timeline.snapshot["cuts"]
        completeness = (
            "full" if all(cut["active_artifact_id"] for cut in cuts) else "partial"
        )
        preview_id = f"prv_{secrets.token_hex(8)}"
        job = self.jobs.create(
            "preview_render",
            project_id,
            {"preview_id": preview_id, "timeline_version_id": timeline.id},
            idempotency_key,
            resource_type="preview",
            resource_id=preview_id,
        )
        now = datetime.now(timezone.utc).isoformat()
        with self.database.transaction() as connection:
            connection.execute(
                """
                INSERT INTO previews(
                    id, project_id, timeline_version_id, completeness, status,
                    job_id, artifact_id, stale_reason, created_at
                ) VALUES (?, ?, ?, ?, 'queued', ?, NULL, NULL, ?)
                """,
                (preview_id, project_id, timeline.id, completeness, job.id, now),
            )
        self.jobs.transition(job.id, "queued")
        return PreviewRecord(
            id=preview_id,
            project_id=project_id,
            timeline_version_id=timeline.id,
            completeness=completeness,
            status="queued",
            job_id=job.id,
        )

    def _preview_for_job(self, job_id: str) -> PreviewRecord:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM previews WHERE job_id = ?", (job_id,)).fetchone()
        if row is None:
            raise DomainError(
                "preview_request_incomplete",
                "Preview 请求尚未完成持久化，请重试。",
                status_code=409,
                retryable=True,
            )
        return _preview_from_row(row)


class PreviewRenderHandler:
    def __init__(
        self,
        database: Database,
        jobs: JobService,
        artifacts: LocalArtifactStore,
        provider: FFmpegRenderProvider,
        *,
        width: int = 1280,
        height: int = 720,
    ) -> None:
        self.database = database
        self.jobs = jobs
        self.artifacts = artifacts
        self.provider = provider
        self.width = width
        self.height = height

    async def __call__(self, job: Job) -> None:
        preview_id = str(job.input["preview_id"])
        with self.database.transaction() as connection:
            preview = connection.execute(
                "SELECT * FROM previews WHERE id = ?", (preview_id,)
            ).fetchone()
            if preview is None:
                raise DomainError("preview_not_found", "Preview 不存在。", status_code=404)
            timeline = connection.execute(
                "SELECT * FROM timeline_versions WHERE id = ?",
                (preview["timeline_version_id"],),
            ).fetchone()
            connection.execute(
                "UPDATE previews SET status = 'rendering' WHERE id = ? AND status != 'stale'",
                (preview_id,),
            )
        snapshot = json.loads(timeline["snapshot_json"])
        audio_path = self._artifact_path(snapshot["audio"]["artifact_id"])
        render_cuts: list[RenderCut] = []
        for cut in snapshot["cuts"]:
            artifact_id = cut["active_artifact_id"]
            render_cuts.append(
                RenderCut(
                    cut_id=cut["cut_id"],
                    duration_ms=cut["end_ms"] - cut["start_ms"],
                    video_path=self._artifact_path(artifact_id) if artifact_id else None,
                )
            )
        artifact_id = f"art_{secrets.token_hex(8)}"
        key = f"{job.project_id}/previews/{preview['timeline_version_id']}/{preview_id}.mp4"
        output_path = self.artifacts.resolve(key)
        try:
            metadata = await asyncio.to_thread(
                self.provider.render_preview,
                audio_path=audio_path,
                cuts=render_cuts,
                output_path=output_path,
                width=self.width,
                height=self.height,
            )
            data = output_path.read_bytes()
            now = datetime.now(timezone.utc).isoformat()
            with self.database.transaction() as connection:
                connection.execute(
                    """
                    INSERT INTO artifacts(
                        id, project_id, type, storage_key, metadata_json, status, expires_at, created_at
                    ) VALUES (?, ?, 'preview', ?, ?, 'ready', NULL, ?)
                    """,
                    (
                        artifact_id,
                        job.project_id,
                        key,
                        json.dumps(
                            {
                                **metadata.model_dump(),
                                "bytes": len(data),
                                "sha256": hashlib.sha256(data).hexdigest(),
                            },
                            sort_keys=True,
                        ),
                        now,
                    ),
                )
                connection.execute(
                    """
                    UPDATE previews
                    SET artifact_id = ?, status = CASE WHEN status = 'stale' THEN 'stale' ELSE 'ready' END
                    WHERE id = ?
                    """,
                    (artifact_id, preview_id),
                )
            self.jobs.set_result_artifact(job.id, artifact_id)
        except Exception:
            with self.database.transaction() as connection:
                connection.execute(
                    "UPDATE previews SET status = 'failed' WHERE id = ? AND status != 'stale'",
                    (preview_id,),
                )
            with self.database.connect() as connection:
                registered = connection.execute(
                    "SELECT 1 FROM artifacts WHERE id = ?", (artifact_id,)
                ).fetchone()
            if registered is None:
                output_path.unlink(missing_ok=True)
            raise

    def _artifact_path(self, artifact_id: str):
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT storage_key, status FROM artifacts WHERE id = ?",
                (artifact_id,),
            ).fetchone()
        if row is None or row["status"] != "ready":
            raise DomainError(
                "render_artifact_not_ready",
                "Timeline 引用的资产不可用。",
                status_code=409,
                details={"artifact_id": artifact_id},
            )
        return self.artifacts.resolve(row["storage_key"])


def _preview_from_row(row: object) -> PreviewRecord:
    return PreviewRecord(
        id=row["id"],
        project_id=row["project_id"],
        timeline_version_id=row["timeline_version_id"],
        completeness=row["completeness"],
        status=row["status"],
        job_id=row["job_id"],
        artifact_id=row["artifact_id"],
        stale_reason=row["stale_reason"],
    )
