from __future__ import annotations

from pathlib import Path

import librosa
import numpy as np

from backend.pipeline.audio_analyzer import analyze_audio
from backend.providers.protocols import AudioAnalysisResult, EnergyPoint, OnsetPoint


def _sample(values: np.ndarray, *, max_points: int) -> np.ndarray:
    if len(values) <= max_points:
        return values
    indices = np.linspace(0, len(values) - 1, max_points, dtype=int)
    return values[indices]


class LibrosaAudioAnalysisProvider:
    def analyze(self, audio_path: str | Path, *, sensitivity: int) -> AudioAnalysisResult:
        analysis = analyze_audio(str(audio_path), sensitivity)
        onset_pairs = list(zip(analysis.onset_times, analysis.onset_env, strict=False))
        energy_pairs = list(zip(analysis.energy_times, analysis.energy_curve, strict=False))
        sampled_onsets = _sample(np.asarray(onset_pairs, dtype=float), max_points=500)
        sampled_energy = _sample(np.asarray(energy_pairs, dtype=float), max_points=500)

        energy_values = analysis.energy_curve.astype(float)
        maximum = float(energy_values.max()) if len(energy_values) else 0.0
        waveform_source = energy_values / maximum if maximum > 0 else energy_values
        waveform = _sample(waveform_source, max_points=400)

        return AudioAnalysisResult(
            duration_ms=round(analysis.duration * 1000),
            bpm=analysis.bpm,
            beats_ms=[round(value * 1000) for value in analysis.beats],
            downbeats_ms=[round(value * 1000) for value in analysis.downbeats],
            onsets=[
                OnsetPoint(time_ms=round(time * 1000), strength=max(0.0, float(strength)))
                for time, strength in sampled_onsets
            ],
            energy_curve=[
                EnergyPoint(time_ms=round(time * 1000), value=max(0.0, float(value)))
                for time, value in sampled_energy
            ],
            waveform=[max(0.0, float(value)) for value in waveform],
            algorithm_version=librosa.__version__,
        )

