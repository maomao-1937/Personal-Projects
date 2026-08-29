from __future__ import annotations

import asyncio
import secrets
from typing import Protocol

from pydantic import BaseModel

from backend.domain.errors import DomainError
from backend.domain.models import Job
from backend.jobs.service import JobService
from backend.persistence.database import Database
from backend.providers.protocols import AudioAnalysisResult
from backend.services.projects import ProjectService
from backend.storage.local_artifacts import LocalArtifactStore


class AudioProvider(Protocol):
    def analyze(self, audio_path, *, sensitivity: int) -> AudioAnalysisResult: ...


class CurrentAudioAnalysis(BaseModel):
    id: str
    audio_asset_id: str
    version: int
    status: str
    job_id: str | None
    result: AudioAnalysisResult


class AudioAnalysisService:
    def __init__(
        self,
        database: Database,
        projects: ProjectService,
        jobs: JobService,
    ) -> None:
        self.database = database
        self.projects = projects
        self.jobs = jobs

    def create(
        self,
        owner_id: str,
        project_id: str,
        *,
        idempotency_key: str,
        sensitivity: int = 50,
    ) -> Job:
        self.projects.get(owner_id, project_id)
        existing = self.jobs.get_by_idempotency_key(idempotency_key)
        if existing is not None:
            if existing.type != "audio_analysis" or existing.project_id != project_id:
                raise DomainError("idempotency_conflict", "该幂等键已用于不同请求。", status_code=409)
            return existing
        with self.database.connect() as connection:
            audio = connection.execute(
                "SELECT * FROM audio_assets WHERE project_id = ? AND is_active = 1",
                (project_id,),
            ).fetchone()
        if audio is None:
            raise DomainError("audio_required", "请先上传音频。", status_code=409)
        job = self.jobs.create(
            "audio_analysis",
            project_id,
            {"audio_asset_id": audio["id"], "sensitivity": sensitivity},
            idempotency_key,
            resource_type="audio_asset",
            resource_id=audio["id"],
            max_attempts=2,
        )
        queued = self.jobs.transition(job.id, "queued")
        with self.database.transaction() as connection:
            connection.execute(
                "UPDATE audio_assets SET status = 'analysis_queued' WHERE id = ?",
                (audio["id"],),
            )
        return queued

    def get_current(self, owner_id: str, project_id: str) -> CurrentAudioAnalysis:
        self.projects.get(owner_id, project_id)
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT analysis.* FROM audio_analyses AS analysis
                JOIN audio_assets AS audio ON audio.id = analysis.audio_asset_id
                WHERE audio.project_id = ? AND audio.is_active = 1 AND analysis.status = 'ready'
                ORDER BY analysis.version DESC LIMIT 1
                """,
                (project_id,),
            ).fetchone()
        if row is None:
            raise DomainError("audio_analysis_not_ready", "音频分析尚未完成。", status_code=409)
        return CurrentAudioAnalysis(
            id=row["id"],
            audio_asset_id=row["audio_asset_id"],
            version=row["version"],
            status=row["status"],
            job_id=row["job_id"],
            result=AudioAnalysisResult.model_validate_json(row["result_json"]),
        )


class AudioAnalysisHandler:
    def __init__(
        self,
        database: Database,
        jobs: JobService,
        artifacts: LocalArtifactStore,
        provider: AudioProvider,
    ) -> None:
        self.database = database
        self.jobs = jobs
        self.artifacts = artifacts
        self.provider = provider

    async def __call__(self, job: Job) -> None:
        audio_asset_id = str(job.input["audio_asset_id"])
        with self.database.transaction() as connection:
            existing = connection.execute(
                "SELECT id FROM audio_analyses WHERE job_id = ? AND status = 'ready'",
                (job.id,),
            ).fetchone()
            if existing is not None:
                connection.execute(
                    "UPDATE audio_assets SET status = 'analyzed' WHERE id = ?",
                    (audio_asset_id,),
                )
                return
            row = connection.execute(
                """
                SELECT audio.*, artifacts.storage_key FROM audio_assets AS audio
                JOIN artifacts ON artifacts.id = audio.artifact_id
                WHERE audio.id = ?
                """,
                (audio_asset_id,),
            ).fetchone()
            if row is None:
                raise DomainError("audio_not_found", "音频不存在。", status_code=404)
            connection.execute(
                "UPDATE audio_assets SET status = 'analyzing' WHERE id = ?",
                (audio_asset_id,),
            )
        try:
            result = await asyncio.to_thread(
                self.provider.analyze,
                self.artifacts.resolve(row["storage_key"]),
                sensitivity=int(job.input["sensitivity"]),
            )
            if abs(result.duration_ms - row["duration_ms"]) > 500:
                raise DomainError(
                    "audio_analysis_duration_mismatch",
                    "音频分析时长与上传文件不一致。",
                    status_code=422,
                    retryable=True,
                )
            analysis_id = f"ana_{secrets.token_hex(8)}"
            with self.database.transaction() as connection:
                version = connection.execute(
                    "SELECT COALESCE(MAX(version), 0) + 1 FROM audio_analyses WHERE audio_asset_id = ?",
                    (audio_asset_id,),
                ).fetchone()[0]
                connection.execute(
                    """
                    INSERT INTO audio_analyses(
                        id, audio_asset_id, version, result_json, status, job_id, created_at
                    ) VALUES (?, ?, ?, ?, 'ready', ?, CURRENT_TIMESTAMP)
                    """,
                    (analysis_id, audio_asset_id, version, result.model_dump_json(), job.id),
                )
                connection.execute(
                    "UPDATE audio_assets SET status = 'analyzed' WHERE id = ?",
                    (audio_asset_id,),
                )
        except Exception:
            with self.database.transaction() as connection:
                connection.execute(
                    "UPDATE audio_assets SET status = 'analysis_failed' WHERE id = ?",
                    (audio_asset_id,),
                )
            raise
