from dataclasses import dataclass
import numpy as np
import librosa


@dataclass
class AudioAnalysis:
    bpm: float
    beats: np.ndarray
    downbeats: np.ndarray
    onset_env: np.ndarray
    onset_times: np.ndarray
    energy_curve: np.ndarray
    energy_times: np.ndarray
    duration: float


def analyze_audio(audio_path: str, sensitivity: int) -> AudioAnalysis:
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    # sensitivity 0=strict (fewer beats, high tightness)
    # sensitivity 100=loose (more beats, low tightness)
    tightness = 400 - (sensitivity / 100) * 300  # 100..400

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, tightness=tightness)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # Downbeats: every 4th beat (assuming 4/4 time)
    downbeat_times = beat_times[::4] if len(beat_times) > 0 else np.array([])

    # Onset strength
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_times = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr)

    # RMS energy
    rms = librosa.feature.rms(y=y)[0]
    energy_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)

    bpm_val = float(tempo) if np.isscalar(tempo) else float(tempo[0])

    return AudioAnalysis(
        bpm=bpm_val,
        beats=beat_times,
        downbeats=downbeat_times,
        onset_env=onset_env,
        onset_times=onset_times,
        energy_curve=rms,
        energy_times=energy_times,
        duration=duration,
    )
