import json
import math
import struct
import wave

import pytest

from backend.providers.audio_librosa import LibrosaAudioAnalysisProvider


def _write_click_track(path, *, seconds: int) -> None:
    sample_rate = 22050
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        for index in range(sample_rate * seconds):
            phase = index % (sample_rate // 2)
            amplitude = 20000 if phase < 200 else 1200
            sample = int(amplitude * math.sin(2 * math.pi * 440 * index / sample_rate))
            output.writeframesraw(struct.pack("<h", sample))


@pytest.fixture(scope="module")
def thirty_second_wav(tmp_path_factory):
    path = tmp_path_factory.mktemp("audio") / "click.wav"
    _write_click_track(path, seconds=30)
    return path


def test_librosa_provider_returns_serializable_analysis(thirty_second_wav) -> None:
    result = LibrosaAudioAnalysisProvider().analyze(thirty_second_wav, sensitivity=50)

    assert result.duration_ms == pytest.approx(30_000, abs=100)
    assert result.bpm > 0
    assert result.beats_ms
    assert result.onsets
    assert result.energy_curve
    json.dumps(result.model_dump())
