from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone

from pydantic import BaseModel

from backend.domain.errors import DomainError
from backend.persistence.database import Database
from backend.providers.protocols import AudioAnalysisResult
from backend.services.projects import ProjectService


class TimelineVersion(BaseModel):
    id: str
    project_id: str
    version: int
    content_hash: str
    snapshot: dict[str, object]
    created_at: str


class TimelineService:
    def __init__(self, database: Database, projects: ProjectService) -> None:
        self.database = database
        self.projects = projects

    def build_current(self, owner_id: str, project_id: str) -> TimelineVersion:
        self.projects.get(owner_id, project_id)
        with self.database.transaction() as connection:
            audio = connection.execute(
                """
                SELECT audio.id AS audio_asset_id, audio.artifact_id AS audio_artifact_id,
                       audio.duration_ms, analysis.id AS analysis_id,
                       analysis.version AS analysis_version, analysis.result_json
                FROM audio_assets AS audio
                JOIN audio_analyses AS analysis ON analysis.audio_asset_id = audio.id
                WHERE audio.project_id = ? AND audio.is_active = 1
                  AND audio.status = 'analyzed' AND analysis.status = 'ready'
                ORDER BY audio.version DESC, analysis.version DESC
                LIMIT 1
                """,
                (project_id,),
            ).fetchone()
            if audio is None:
                raise DomainError(
                    "audio_analysis_required",
                    "请先完成当前音频的分析。",
                    status_code=409,
                )
            storyboard = connection.execute(
                """
                SELECT * FROM storyboards
                WHERE project_id = ? AND status = 'confirmed'
                ORDER BY version DESC LIMIT 1
                """,
                (project_id,),
            ).fetchone()
            if storyboard is None:
                raise DomainError(
                    "confirmed_storyboard_required",
                    "请先确认 Storyboard。",
                    status_code=409,
                )
            cuts = connection.execute(
                "SELECT * FROM cuts WHERE storyboard_id = ? ORDER BY order_index",
                (storyboard["id"],),
            ).fetchall()
            analysis = AudioAnalysisResult.model_validate_json(audio["result_json"])
            self._validate_cuts(cuts, analysis.duration_ms)
            storyboard_metadata = json.loads(storyboard["plot_json"])
            snapshot: dict[str, object] = {
                "audio": {
                    "audio_asset_id": audio["audio_asset_id"],
                    "artifact_id": audio["audio_artifact_id"],
                    "analysis_id": audio["analysis_id"],
                    "analysis_version": audio["analysis_version"],
                    "duration_ms": audio["duration_ms"],
                },
                "audio_features": {
                    "bpm": analysis.bpm,
                    "beats_ms": analysis.beats_ms,
                    "downbeats_ms": analysis.downbeats_ms,
                    "waveform": analysis.waveform,
                },
                "storyboard": {
                    "id": storyboard["id"],
                    "version": storyboard["version"],
                    "beat_plan_version": storyboard_metadata.get("beat_plan", {}).get(
                        "version", storyboard["version"]
                    ),
                },
                "cuts": [
                    {
                        "cut_id": cut["id"],
                        "order_index": cut["order_index"],
                        "start_ms": cut["start_ms"],
                        "end_ms": cut["end_ms"],
                        "active_artifact_id": cut["active_artifact_id"],
                    }
                    for cut in cuts
                ],
                "render": {
                    "transition": "hard_cut",
                    "master_aspect_ratio": "16:9",
                    "safe_area_version": "p0-v1",
                    "video_codec": "h264",
                    "audio_codec": "aac",
                },
            }
            canonical = json.dumps(
                snapshot,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
            content_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            existing = connection.execute(
                "SELECT * FROM timeline_versions WHERE project_id = ? AND content_hash = ?",
                (project_id, content_hash),
            ).fetchone()
            if existing is not None:
                connection.execute(
                    "UPDATE projects SET current_timeline_version_id = ?, updated_at = ? WHERE id = ?",
                    (existing["id"], datetime.now(timezone.utc).isoformat(), project_id),
                )
                return _timeline_from_row(existing)

            version = connection.execute(
                "SELECT COALESCE(MAX(version), 0) + 1 FROM timeline_versions WHERE project_id = ?",
                (project_id,),
            ).fetchone()[0]
            timeline_id = f"tlv_{secrets.token_hex(8)}"
            now = datetime.now(timezone.utc).isoformat()
            connection.execute(
                """
                INSERT INTO timeline_versions(
                    id, project_id, version, content_hash, snapshot_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (timeline_id, project_id, version, content_hash, canonical, now),
            )
            connection.execute(
                "UPDATE projects SET current_timeline_version_id = ?, updated_at = ? WHERE id = ?",
                (timeline_id, now, project_id),
            )
            connection.execute(
                """
                UPDATE previews
                SET status = 'stale', stale_reason = 'timeline_changed'
                WHERE project_id = ? AND timeline_version_id != ? AND status != 'stale'
                """,
                (project_id, timeline_id),
            )
            connection.execute(
                """
                UPDATE exports
                SET status = 'stale', stale_reason = 'timeline_changed'
                WHERE project_id = ? AND timeline_version_id != ? AND status != 'stale'
                """,
                (project_id, timeline_id),
            )
        return TimelineVersion(
            id=timeline_id,
            project_id=project_id,
            version=version,
            content_hash=content_hash,
            snapshot=snapshot,
            created_at=now,
        )

    @staticmethod
    def _validate_cuts(cuts: list[object], duration_ms: int) -> None:
        if not cuts:
            raise DomainError("timeline_has_no_cuts", "Timeline 没有 Cut。", status_code=409)
        if cuts[0]["start_ms"] != 0 or cuts[-1]["end_ms"] != duration_ms:
            raise DomainError(
                "timeline_cut_coverage_invalid",
                "Cut 没有连续覆盖完整音频。",
                status_code=422,
            )
        for index, cut in enumerate(cuts):
            if cut["order_index"] != index or cut["end_ms"] <= cut["start_ms"]:
                raise DomainError(
                    "timeline_cut_order_invalid",
                    "Cut 顺序或时间范围不合法。",
                    status_code=422,
                )
            if index and cuts[index - 1]["end_ms"] != cut["start_ms"]:
                raise DomainError(
                    "timeline_cut_coverage_invalid",
                    "Cut 之间存在空隙或重叠。",
                    status_code=422,
                )


def _timeline_from_row(row: object) -> TimelineVersion:
    return TimelineVersion(
        id=row["id"],
        project_id=row["project_id"],
        version=row["version"],
        content_hash=row["content_hash"],
        snapshot=json.loads(row["snapshot_json"]),
        created_at=row["created_at"],
    )
