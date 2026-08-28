from __future__ import annotations

import math
from bisect import bisect_left

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.domain.errors import DomainError
from backend.providers.protocols import AudioAnalysisResult


class PlotSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: str = Field(min_length=1, max_length=300)
    visual_arc: str = Field(min_length=1, max_length=1_000)
    emotional_arc: str = Field(min_length=1, max_length=1_000)
    visual_style: str = Field(min_length=1, max_length=500)


class StoryboardCutDraft(BaseModel):
    """Semantic cut returned by the model.

    Provider timecodes are accepted for diagnostics but never become authoritative.
    The server-owned BeatPlan supplies all final boundaries.
    """

    model_config = ConfigDict(extra="forbid")

    start_ms: int | None = Field(default=None, ge=0)
    end_ms: int | None = Field(default=None, gt=0)
    prompt: str = Field(min_length=1, max_length=4_000)
    mood: str = Field(min_length=1, max_length=200)
    camera: str = Field(min_length=1, max_length=500)
    action: str = Field(min_length=1, max_length=1_000)


class StoryboardDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plot: PlotSpec
    cuts: list[StoryboardCutDraft] = Field(min_length=1, max_length=12)


class BeatPlanSegment(BaseModel):
    order_index: int = Field(ge=0)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)
    energy_label: str
    cut_reason: str

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms

    @model_validator(mode="after")
    def validate_range(self) -> "BeatPlanSegment":
        if self.end_ms <= self.start_ms:
            raise ValueError("end_ms must be greater than start_ms")
        return self


class BeatPlan(BaseModel):
    duration_ms: int = Field(gt=0)
    bpm: float = Field(gt=0)
    segments: list[BeatPlanSegment] = Field(min_length=1, max_length=12)

    def provider_summary(self) -> dict[str, object]:
        return {
            "duration_ms": self.duration_ms,
            "bpm": round(self.bpm, 2),
            "cut_count": len(self.segments),
            "segments": [segment.model_dump() for segment in self.segments],
        }


class NormalizedStoryboardCut(BaseModel):
    id: str
    order_index: int = Field(ge=0)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)
    prompt: str
    mood: str
    camera: str
    action: str
    energy_label: str
    cut_reason: str


class NormalizedStoryboard(BaseModel):
    plot: PlotSpec
    cuts: list[NormalizedStoryboardCut] = Field(min_length=1, max_length=12)


def build_beat_plan(
    analysis: AudioAnalysisResult,
    *,
    min_cut_ms: int = 4_000,
    max_cut_ms: int = 6_000,
    max_cut_count: int = 12,
) -> BeatPlan:
    """Turn audio features into deterministic, continuous cut boundaries."""

    duration_ms = analysis.duration_ms
    if min_cut_ms <= 0 or max_cut_ms < min_cut_ms or max_cut_count < 1:
        raise _unfulfillable(duration_ms, min_cut_ms, max_cut_ms, max_cut_count)

    minimum_required = math.ceil(duration_ms / max_cut_ms)
    maximum_allowed = min(max_cut_count, duration_ms // min_cut_ms)
    minimum_storyboard_count = max(4, minimum_required)
    if maximum_allowed < minimum_storyboard_count:
        raise _unfulfillable(duration_ms, min_cut_ms, max_cut_ms, max_cut_count)

    desired_count = round(duration_ms / 5_000)
    cut_count = min(max(desired_count, minimum_storyboard_count), maximum_allowed)
    onset_strength = {point.time_ms: point.strength for point in analysis.onsets}
    max_onset = max(onset_strength.values(), default=1.0) or 1.0
    downbeats = set(analysis.downbeats_ms)

    boundaries = [0]
    sorted_beats = sorted(set(analysis.beats_ms))
    for index in range(1, cut_count):
        previous = boundaries[-1]
        remaining = cut_count - index
        lower = max(previous + min_cut_ms, duration_ms - remaining * max_cut_ms)
        upper = min(previous + max_cut_ms, duration_ms - remaining * min_cut_ms)
        if lower > upper:
            raise _unfulfillable(duration_ms, min_cut_ms, max_cut_ms, max_cut_count)

        ideal = round(duration_ms * index / cut_count)
        valid_beats = _values_between(sorted_beats, lower, upper)
        if valid_beats:
            boundary = min(
                valid_beats,
                key=lambda beat: (
                    abs(beat - ideal)
                    - (250 if beat in downbeats else 0)
                    - 250 * onset_strength.get(beat, 0.0) / max_onset,
                    abs(beat - ideal),
                    beat,
                ),
            )
        else:
            boundary = min(max(ideal, lower), upper)
        boundaries.append(boundary)
    boundaries.append(duration_ms)

    energy_values = [point.value for point in analysis.energy_curve]
    max_energy = max(energy_values, default=1.0) or 1.0
    segments = []
    for order_index, (start_ms, end_ms) in enumerate(
        zip(boundaries, boundaries[1:], strict=False)
    ):
        relative_energy = _average_energy(analysis, start_ms, end_ms) / max_energy
        energy_label = "high" if relative_energy >= 0.67 else "low" if relative_energy <= 0.33 else "medium"
        segments.append(
            BeatPlanSegment(
                order_index=order_index,
                start_ms=start_ms,
                end_ms=end_ms,
                energy_label=energy_label,
                cut_reason=_boundary_reason(end_ms, duration_ms, downbeats, onset_strength, max_onset),
            )
        )

    return BeatPlan(duration_ms=duration_ms, bpm=analysis.bpm, segments=segments)


def normalize_storyboard(draft: StoryboardDraft, beat_plan: BeatPlan) -> NormalizedStoryboard:
    """Combine model semantics with authoritative server timing."""

    expected_count = len(beat_plan.segments)
    if len(draft.cuts) != expected_count:
        raise DomainError(
            code="storyboard_cut_count_mismatch",
            message=f"Storyboard must contain exactly {expected_count} cuts",
            status_code=422,
            retryable=True,
            details={"expected": expected_count, "actual": len(draft.cuts)},
        )

    cuts = []
    for index, (semantic, timing) in enumerate(
        zip(draft.cuts, beat_plan.segments, strict=True),
        start=1,
    ):
        cuts.append(
            NormalizedStoryboardCut(
                id=f"cut_{index:02d}",
                order_index=index - 1,
                start_ms=timing.start_ms,
                end_ms=timing.end_ms,
                prompt=semantic.prompt,
                mood=semantic.mood,
                camera=semantic.camera,
                action=semantic.action,
                energy_label=timing.energy_label,
                cut_reason=timing.cut_reason,
            )
        )
    return NormalizedStoryboard(plot=draft.plot, cuts=cuts)


def _values_between(values: list[int], lower: int, upper: int) -> list[int]:
    start = bisect_left(values, lower)
    end = bisect_left(values, upper + 1)
    return values[start:end]


def _average_energy(analysis: AudioAnalysisResult, start_ms: int, end_ms: int) -> float:
    values = [
        point.value
        for point in analysis.energy_curve
        if start_ms <= point.time_ms < end_ms
    ]
    return sum(values) / len(values) if values else 0.0


def _boundary_reason(
    boundary_ms: int,
    duration_ms: int,
    downbeats: set[int],
    onset_strength: dict[int, float],
    max_onset: float,
) -> str:
    if boundary_ms == duration_ms:
        return "audio_end"
    if boundary_ms in downbeats:
        return "downbeat"
    if onset_strength.get(boundary_ms, 0.0) / max_onset >= 0.67:
        return "strong_onset"
    return "beat"


def _unfulfillable(
    duration_ms: int,
    min_cut_ms: int,
    max_cut_ms: int,
    max_cut_count: int,
) -> DomainError:
    return DomainError(
        code="beat_plan_unfulfillable",
        message="Audio duration cannot satisfy the configured cut limits",
        status_code=422,
        retryable=False,
        details={
            "duration_ms": duration_ms,
            "min_cut_ms": min_cut_ms,
            "max_cut_ms": max_cut_ms,
            "max_cut_count": max_cut_count,
        },
    )
