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


class ExportRecord(BaseModel):
    id: str | None = None
    project_id: str
    timeline_version_id: str
    aspect_ratio: str
    resolution: str
    status: str
    job_id: str | None = None
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

    def create_export(
        self,
        owner_id: str,
        project_id: str,
        *,
        aspect_ratio: str,
        idempotency_key: str,
    ) -> ExportRecord:
        resolution = _export_resolution(aspect_ratio)
        self.projects.get(owner_id, project_id)
        existing_job = self.jobs.get_by_idempotency_key(idempotency_key)
        if existing_job is not None:
            if existing_job.project_id != project_id or existing_job.type != "export_render":
                raise DomainError("idempotency_conflict", "该幂等键已用于不同请求。", status_code=409)
            return self._export_for_job(existing_job.id)
        timeline = self.timelines.build_current(owner_id, project_id)
        if not all(cut["active_artifact_id"] for cut in timeline.snapshot["cuts"]):
            raise DomainError(
                "export_requires_all_cuts",
                "所有 Cut 成功后才能正式导出。",
                status_code=409,
            )
        with self.database.connect() as connection:
            existing = connection.execute(
                "SELECT * FROM exports WHERE timeline_version_id = ? AND aspect_ratio = ?",
                (timeline.id, aspect_ratio),
            ).fetchone()
        if existing is not None:
            return _export_from_row(existing)

        export_id = f"exp_{secrets.token_hex(8)}"
        job = self.jobs.create(
            "export_render",
            project_id,
            {
                "export_id": export_id,
                "timeline_version_id": timeline.id,
                "aspect_ratio": aspect_ratio,
                "resolution": resolution,
            },
            idempotency_key,
            resource_type="export",
            resource_id=export_id,
        )
        now = datetime.now(timezone.utc).isoformat()
        with self.database.transaction() as connection:
            connection.execute(
                """
                INSERT INTO exports(
                    id, project_id, timeline_version_id, aspect_ratio, resolution,
                    status, job_id, artifact_id, stale_reason, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, 'queued', ?, NULL, NULL, ?, NULL)
                """,
                (export_id, project_id, timeline.id, aspect_ratio, resolution, job.id, now),
            )
        self.jobs.transition(job.id, "queued")
        return ExportRecord(
            id=export_id,
            project_id=project_id,
            timeline_version_id=timeline.id,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            status="queued",
            job_id=job.id,
        )

    def export_status(self, owner_id: str, project_id: str, aspect_ratio: str) -> ExportRecord:
        resolution = _export_resolution(aspect_ratio)
        timeline = self.timelines.build_current(owner_id, project_id)
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM exports WHERE timeline_version_id = ? AND aspect_ratio = ?",
                (timeline.id, aspect_ratio),
            ).fetchone()
        if row is None:
            return ExportRecord(
                project_id=project_id,
                timeline_version_id=timeline.id,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                status="not_created",
            )
        return _export_from_row(row)

    def _export_for_job(self, job_id: str) -> ExportRecord:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM exports WHERE job_id = ?", (job_id,)).fetchone()
        if row is None:
            raise DomainError(
                "export_request_incomplete",
                "Export 请求尚未完成持久化，请重试。",
                status_code=409,
                retryable=True,
            )
        return _export_from_row(row)


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


class ExportRenderHandler:
    def __init__(
        self,
        database: Database,
        jobs: JobService,
        artifacts: LocalArtifactStore,
        provider: FFmpegRenderProvider,
        *,
        dimensions: dict[str, tuple[int, int]] | None = None,
    ) -> None:
        self.database = database
        self.jobs = jobs
        self.artifacts = artifacts
        self.provider = provider
        self.dimensions = dimensions or {"16:9": (1920, 1080), "9:16": (1080, 1920)}

    async def __call__(self, job: Job) -> None:
        export_id = str(job.input["export_id"])
        with self.database.transaction() as connection:
            export = connection.execute("SELECT * FROM exports WHERE id = ?", (export_id,)).fetchone()
            if export is None:
                raise DomainError("export_not_found", "Export 不存在。", status_code=404)
            timeline = connection.execute(
                "SELECT * FROM timeline_versions WHERE id = ?", (export["timeline_version_id"],)
            ).fetchone()
            connection.execute(
                "UPDATE exports SET status = 'rendering' WHERE id = ? AND status != 'stale'",
                (export_id,),
            )
        snapshot = json.loads(timeline["snapshot_json"])
        audio_path = self._artifact_path(snapshot["audio"]["artifact_id"])
        cuts = []
        for cut in snapshot["cuts"]:
            if not cut["active_artifact_id"]:
                raise DomainError(
                    "export_requires_all_cuts",
                    "正式导出不能包含占位 Cut。",
                    status_code=409,
                )
            cuts.append(
                RenderCut(
                    cut_id=cut["cut_id"],
                    duration_ms=cut["end_ms"] - cut["start_ms"],
                    video_path=self._artifact_path(cut["active_artifact_id"]),
                )
            )
        aspect_ratio = str(export["aspect_ratio"])
        width, height = self.dimensions[aspect_ratio]
        artifact_id = f"art_{secrets.token_hex(8)}"
        key = f"{job.project_id}/exports/{export['timeline_version_id']}/{aspect_ratio.replace(':', 'x')}.mp4"
        output_path = self.artifacts.resolve(key)
        try:
            metadata = await asyncio.to_thread(
                self.provider.render_preview,
                audio_path=audio_path,
                cuts=cuts,
                output_path=output_path,
                width=width,
                height=height,
            )
            data = output_path.read_bytes()
            now = datetime.now(timezone.utc).isoformat()
            with self.database.transaction() as connection:
                connection.execute(
                    """
                    INSERT INTO artifacts(
                        id, project_id, type, storage_key, metadata_json, status, expires_at, created_at
                    ) VALUES (?, ?, 'export', ?, ?, 'ready', NULL, ?)
                    """,
                    (
                        artifact_id,
                        job.project_id,
                        key,
                        json.dumps(
                            {
                                **metadata.model_dump(),
                                "aspect_ratio": aspect_ratio,
                                "bytes": len(data),
                                "sha256": hashlib.sha256(data).hexdigest(),
                                "watermark": False,
                            },
                            sort_keys=True,
                        ),
                        now,
                    ),
                )
                connection.execute(
                    """
                    UPDATE exports
                    SET artifact_id = ?, completed_at = ?,
                        status = CASE WHEN status = 'stale' THEN 'stale' ELSE 'ready' END
                    WHERE id = ?
                    """,
                    (artifact_id, now, export_id),
                )
            self.jobs.set_result_artifact(job.id, artifact_id)
        except Exception:
            with self.database.transaction() as connection:
                connection.execute(
                    "UPDATE exports SET status = 'failed' WHERE id = ? AND status != 'stale'",
                    (export_id,),
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
                "SELECT storage_key, status FROM artifacts WHERE id = ?", (artifact_id,)
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


def _export_from_row(row: object) -> ExportRecord:
    return ExportRecord(
        id=row["id"],
        project_id=row["project_id"],
        timeline_version_id=row["timeline_version_id"],
        aspect_ratio=row["aspect_ratio"],
        resolution=row["resolution"],
        status=row["status"],
        job_id=row["job_id"],
        artifact_id=row["artifact_id"],
        stale_reason=row["stale_reason"],
    )


def _export_resolution(aspect_ratio: str) -> str:
    resolutions = {"16:9": "1920x1080", "9:16": "1080x1920"}
    try:
        return resolutions[aspect_ratio]
    except KeyError as exc:
        raise DomainError(
            "export_aspect_ratio_unsupported",
            "P0 仅支持 16:9 和 9:16 导出。",
            status_code=422,
        ) from exc
