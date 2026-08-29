from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import soundfile

from backend.domain.errors import DomainError
from backend.persistence.database import Database
from backend.services.projects import ProjectService
from backend.storage.local_artifacts import LocalArtifactStore


@dataclass(frozen=True, slots=True)
class UploadedAudio:
    id: str
    project_id: str
    artifact_id: str
    version: int
    checksum: str
    duration_ms: int
    status: str
    filename: str


class AudioService:
    ALLOWED_TYPES = {
        ".mp3": {"audio/mpeg", "audio/mp3"},
        ".wav": {"audio/wav", "audio/x-wav", "audio/wave"},
    }

    def __init__(
        self,
        database: Database,
        projects: ProjectService,
        artifacts: LocalArtifactStore,
        *,
        max_bytes: int,
        min_seconds: int,
        max_seconds: int,
    ) -> None:
        self.database = database
        self.projects = projects
        self.artifacts = artifacts
        self.max_bytes = max_bytes
        self.min_seconds = min_seconds
        self.max_seconds = max_seconds

    def upload(
        self,
        owner_id: str,
        project_id: str,
        *,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> UploadedAudio:
        self.projects.get(owner_id, project_id)
        suffix = Path(filename).suffix.lower()
        if suffix not in self.ALLOWED_TYPES or content_type not in self.ALLOWED_TYPES[suffix]:
            raise DomainError(
                "unsupported_audio_format",
                "P0 仅支持 MP3 和 WAV。",
                status_code=415,
            )
        if len(data) > self.max_bytes:
            raise DomainError(
                "audio_too_large",
                "音频文件超过 100 MB。",
                status_code=413,
                details={"max_bytes": self.max_bytes},
            )
        try:
            info = soundfile.info(BytesIO(data))
        except Exception as exc:
            raise DomainError(
                "invalid_audio_file",
                "音频文件损坏或无法读取。",
                status_code=422,
            ) from exc
        duration_ms = round((info.frames / info.samplerate) * 1000)
        if not self.min_seconds * 1000 <= duration_ms <= self.max_seconds * 1000:
            raise DomainError(
                "audio_duration_out_of_range",
                f"音频时长必须在 {self.min_seconds}—{self.max_seconds} 秒之间。",
                status_code=422,
                details={"min_seconds": self.min_seconds, "max_seconds": self.max_seconds},
            )

        audio_id = f"aud_{secrets.token_hex(8)}"
        artifact_id = f"art_{secrets.token_hex(8)}"
        key = f"{project_id}/audio/{audio_id}{suffix}"
        stored = self.artifacts.put_bytes(key, data)
        now = datetime.now(timezone.utc).isoformat()
        with self.database.transaction() as connection:
            version = connection.execute(
                "SELECT COALESCE(MAX(version), 0) + 1 FROM audio_assets WHERE project_id = ?",
                (project_id,),
            ).fetchone()[0]
            connection.execute(
                "UPDATE audio_assets SET is_active = 0 WHERE project_id = ?",
                (project_id,),
            )
            connection.execute(
                """
                INSERT INTO artifacts(
                    id, project_id, type, storage_key, metadata_json, status, expires_at, created_at
                ) VALUES (?, ?, 'audio', ?, ?, 'ready', NULL, ?)
                """,
                (
                    artifact_id,
                    project_id,
                    stored.key,
                    json.dumps(
                        {
                            "filename": filename,
                            "content_type": content_type,
                            "bytes": stored.bytes,
                            "duration_ms": duration_ms,
                        },
                        ensure_ascii=False,
                        sort_keys=True,
                    ),
                    now,
                ),
            )
            connection.execute(
                """
                INSERT INTO audio_assets(
                    id, project_id, artifact_id, version, checksum, duration_ms,
                    status, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'uploaded', 1, ?)
                """,
                (
                    audio_id,
                    project_id,
                    artifact_id,
                    version,
                    stored.sha256,
                    duration_ms,
                    now,
                ),
            )
        return UploadedAudio(
            id=audio_id,
            project_id=project_id,
            artifact_id=artifact_id,
            version=version,
            checksum=stored.sha256,
            duration_ms=duration_ms,
            status="uploaded",
            filename=filename,
        )

