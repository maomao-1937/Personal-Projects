from __future__ import annotations

from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, Field


class OnsetPoint(BaseModel):
    time_ms: int = Field(ge=0)
    strength: float = Field(ge=0)


class EnergyPoint(BaseModel):
    time_ms: int = Field(ge=0)
    value: float = Field(ge=0)


class AudioAnalysisResult(BaseModel):
    duration_ms: int = Field(gt=0)
    bpm: float = Field(gt=0)
    beats_ms: list[int]
    downbeats_ms: list[int]
    onsets: list[OnsetPoint]
    energy_curve: list[EnergyPoint]
    waveform: list[float]
    algorithm: str = "librosa"
    algorithm_version: str


class AudioAnalysisProvider(Protocol):
    def analyze(self, audio_path: str | Path, *, sensitivity: int) -> AudioAnalysisResult:
        ...

