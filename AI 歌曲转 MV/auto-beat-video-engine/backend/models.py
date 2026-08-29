from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field


class ProcessSettings(BaseModel):
    aggressiveness: int = Field(50, ge=0, le=100)
    motionBias: int = Field(50, ge=0, le=100)
    sensitivity: int = Field(50, ge=0, le=100)


class JobStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    ANALYZING_AUDIO = "analyzing_audio"
    ANALYZING_VIDEO = "analyzing_video"
    SYNCING = "syncing"
    EXPORTING = "exporting"
    COMPLETE = "complete"
    FAILED = "failed"


class ProcessResponse(BaseModel):
    job_id: str
    message: str
