from dataclasses import dataclass
import math
import numpy as np
from models import ProcessSettings
from pipeline.audio_analyzer import AudioAnalysis
from pipeline.video_analyzer import VideoAnalysis


@dataclass
class CutSegment:
    start: float  # start time in source video (seconds)
    end: float    # end time in source video (seconds)


def _interp(times: np.ndarray, values: np.ndarray, t: float) -> float:
    if len(times) == 0:
        return 0.0
    return float(np.interp(t, times, values))


def _subdivide_beats(beats: np.ndarray, n: int) -> np.ndarray:
    result = []
    for i in range(len(beats) - 1):
        for j in range(n):
            t = beats[i] + (beats[i + 1] - beats[i]) * j / n
            result.append(t)
    if len(beats) > 0:
        result.append(beats[-1])
    return np.array(result)


def compute_beat_sync_cuts(
    audio: AudioAnalysis,
    video: VideoAnalysis,
    settings: ProcessSettings,
) -> list[CutSegment]:
    agg = settings.aggressiveness / 100.0
    mb = settings.motionBias / 100.0
    beats = audio.beats
    downbeats = audio.downbeats

    if len(beats) < 2:
        # Not enough beats — just return the whole video as one segment
        return [CutSegment(start=0.0, end=min(video.duration, audio.duration))]

    # Step 1: Build candidate cut points based on aggressiveness
    if agg <= 0.25:
        candidates = downbeats if len(downbeats) > 1 else beats[::4]
    elif agg <= 0.5:
        step = max(1, round(4 * (1 - (agg - 0.25) / 0.25)))
        candidates = beats[::step]
    elif agg <= 0.75:
        candidates = beats.copy()
    else:
        subdivisions = 2 if agg <= 0.87 else 4
        candidates = _subdivide_beats(beats, subdivisions)

    if len(candidates) < 2:
        candidates = beats.copy()

    # Step 2: Score each candidate
    scored = []
    for t in candidates:
        motion = _interp(video.motion_times, video.motion_scores, t)
        energy = _interp(audio.energy_times, audio.energy_curve, t)

        # Normalize energy
        e_max = audio.energy_curve.max() if len(audio.energy_curve) > 0 else 1.0
        energy_norm = energy / e_max if e_max > 0 else 0.0

        # Scene boundary bonus
        scene_bonus = 0.0
        if video.scenes:
            nearest = min(abs(t - s) for s in video.scenes)
            if nearest < 0.5:
                scene_bonus = 1.0

        score = (1.0 - mb) * 1.0 + mb * motion + 0.15 * scene_bonus + 0.1 * energy_norm
        scored.append((t, score, scene_bonus > 0))

    # Step 3: Filter low-scoring candidates
    scored.sort(key=lambda x: x[1], reverse=True)
    keep_ratio = 0.6 + 0.3 * agg
    n_keep = max(2, math.ceil(len(scored) * keep_ratio))

    kept = list(scored[:n_keep])
    # Always keep scene-boundary cuts
    for item in scored[n_keep:]:
        if item[2]:
            kept.append(item)

    kept.sort(key=lambda x: x[0])  # sort by time
    cut_times = [x[0] for x in kept]

    # Step 4: Enforce minimum segment duration
    min_seg = 2.0 - 1.7 * agg  # 2.0s at agg=0, 0.3s at agg=100
    filtered = [cut_times[0]]
    for t in cut_times[1:]:
        if t - filtered[-1] >= min_seg:
            filtered.append(t)

    # Step 5: Build segments
    # Each cut point defines a moment in the audio timeline.
    # We map segments sequentially from the source video.
    segments = []
    video_cursor = 0.0

    for i in range(len(filtered)):
        if i + 1 < len(filtered):
            seg_duration = filtered[i + 1] - filtered[i]
        else:
            seg_duration = audio.duration - filtered[i]
            if seg_duration <= 0:
                break

        # If motionBias is high, try to find high-motion window
        if mb > 0.7 and len(video.motion_scores) > 0:
            best_start = _find_best_motion_window(
                video.motion_scores, video.motion_times,
                seg_duration, video.duration, video_cursor
            )
            segments.append(CutSegment(start=best_start, end=best_start + seg_duration))
            video_cursor = best_start + seg_duration
        else:
            # Sequential
            if video_cursor + seg_duration > video.duration:
                video_cursor = 0.0
            segments.append(CutSegment(start=video_cursor, end=video_cursor + seg_duration))
            video_cursor += seg_duration

    return segments


def _find_best_motion_window(
    motion: np.ndarray, times: np.ndarray,
    duration: float, video_duration: float, hint_start: float
) -> float:
    """Find the window of `duration` seconds with highest average motion."""
    if len(times) == 0 or duration <= 0:
        return 0.0

    best_score = -1.0
    best_start = hint_start

    step = max(0.5, duration / 4)
    t = 0.0
    while t + duration <= video_duration:
        mask = (times >= t) & (times < t + duration)
        if mask.any():
            avg = motion[mask].mean()
            if avg > best_score:
                best_score = avg
                best_start = t
        t += step

    return best_start
