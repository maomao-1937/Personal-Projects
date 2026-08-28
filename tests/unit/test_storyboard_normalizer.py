from __future__ import annotations

import pytest

from backend.domain.errors import DomainError
from backend.providers.protocols import AudioAnalysisResult, EnergyPoint, OnsetPoint
from backend.services.storyboards import (
    PlotSpec,
    StoryboardCutDraft,
    StoryboardDraft,
    build_beat_plan,
    normalize_storyboard,
)


def _analysis(duration_ms: int = 60_000) -> AudioAnalysisResult:
    beats = list(range(500, duration_ms, 500))
    return AudioAnalysisResult(
        duration_ms=duration_ms,
        bpm=120,
        beats_ms=beats,
        downbeats_ms=beats[3::4],
        onsets=[
            OnsetPoint(time_ms=time_ms, strength=1.0 if time_ms % 2_000 == 0 else 0.3)
            for time_ms in beats
        ],
        energy_curve=[
            EnergyPoint(time_ms=time_ms, value=0.25 + 0.75 * time_ms / duration_ms)
            for time_ms in range(0, duration_ms, 500)
        ],
        waveform=[0.0],
        algorithm_version="test",
    )


def _draft(count: int) -> StoryboardDraft:
    return StoryboardDraft(
        plot=PlotSpec(
            theme="追光",
            visual_arc="从暗处走向日出",
            emotional_arc="克制到释放",
            visual_style="电影感现实主义",
        ),
        cuts=[
            StoryboardCutDraft(
                start_ms=900 + index * 3_000,
                end_ms=8_000 + index * 3_000,
                prompt=f"镜头 {index + 1}",
                mood="坚定",
                camera="手持推进",
                action="人物向前奔跑",
            )
            for index in range(count)
        ],
    )


def test_beat_plan_is_contiguous_bounded_and_snapped_to_beats() -> None:
    analysis = _analysis()

    plan = build_beat_plan(
        analysis,
        min_cut_ms=4_000,
        max_cut_ms=6_000,
        max_cut_count=12,
    )

    assert 4 <= len(plan.segments) <= 12
    assert plan.segments[0].start_ms == 0
    assert plan.segments[-1].end_ms == analysis.duration_ms
    assert [segment.order_index for segment in plan.segments] == list(range(len(plan.segments)))
    for previous, current in zip(plan.segments, plan.segments[1:], strict=False):
        assert previous.end_ms == current.start_ms
        assert min(abs(current.start_ms - beat) for beat in analysis.beats_ms) <= 250
    assert all(4_000 <= segment.duration_ms <= 6_000 for segment in plan.segments)


def test_normalizer_uses_server_beat_boundaries_not_provider_timecodes() -> None:
    plan = build_beat_plan(_analysis(30_000))

    storyboard = normalize_storyboard(_draft(len(plan.segments)), plan)

    assert storyboard.cuts[0].start_ms == 0
    assert storyboard.cuts[-1].end_ms == 30_000
    assert [cut.id for cut in storyboard.cuts] == [f"cut_{index:02d}" for index in range(1, len(plan.segments) + 1)]
    assert [cut.order_index for cut in storyboard.cuts] == list(range(len(plan.segments)))
    assert all(cut.energy_label in {"low", "medium", "high"} for cut in storyboard.cuts)
    assert all(cut.cut_reason for cut in storyboard.cuts)
    for previous, current in zip(storyboard.cuts, storyboard.cuts[1:], strict=False):
        assert previous.end_ms == current.start_ms


def test_normalizer_rejects_semantic_cut_count_mismatch() -> None:
    plan = build_beat_plan(_analysis(30_000))

    with pytest.raises(DomainError) as exc_info:
        normalize_storyboard(_draft(len(plan.segments) - 1), plan)

    assert exc_info.value.code == "storyboard_cut_count_mismatch"
    assert exc_info.value.retryable is True


def test_beat_plan_rejects_impossible_provider_duration_limits() -> None:
    with pytest.raises(DomainError) as exc_info:
        build_beat_plan(
            _analysis(60_000),
            min_cut_ms=6_000,
            max_cut_ms=6_000,
            max_cut_count=8,
        )

    assert exc_info.value.code == "beat_plan_unfulfillable"
