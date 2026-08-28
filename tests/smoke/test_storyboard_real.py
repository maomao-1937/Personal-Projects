from __future__ import annotations

import os

import pytest

from backend.config import Settings
from backend.providers.storyboard_openai import OpenAICompatibleStoryboardProvider
from backend.services.storyboards import BeatPlan, BeatPlanSegment


pytestmark = pytest.mark.real_model


def test_real_storyboard_provider_returns_six_structured_cuts() -> None:
    if os.getenv("RUN_REAL_MODEL_SMOKE") != "1":
        pytest.skip("set RUN_REAL_MODEL_SMOKE=1 to make one real text-model request")
    settings = Settings()
    if not (
        settings.storyboard_api_key
        and settings.storyboard_base_url
        and settings.storyboard_model
    ):
        pytest.skip("Storyboard Provider is not configured")
    provider = OpenAICompatibleStoryboardProvider(
        api_key=settings.storyboard_api_key.get_secret_value(),
        base_url=settings.storyboard_base_url,
        model=settings.storyboard_model,
        timeout_seconds=settings.storyboard_timeout_seconds,
        max_attempts=1,
    )
    plan = BeatPlan(
        duration_ms=30_000,
        bpm=120,
        segments=[
            BeatPlanSegment(
                order_index=index,
                start_ms=index * 5_000,
                end_ms=(index + 1) * 5_000,
                energy_label="low" if index < 2 else "high" if index > 3 else "medium",
                cut_reason="downbeat",
            )
            for index in range(6)
        ],
    )

    result = provider.generate(
        creative_brief="一位匿名舞者在雨夜城市中追逐晨光；无真人肖像、无品牌、无文字。",
        audio_summary={"duration_ms": 30_000, "bpm": 120, "beat_count": 60},
        beat_plan=plan,
    )

    assert len(result.cuts) == 6
    assert all(cut.prompt and cut.camera and cut.action for cut in result.cuts)
