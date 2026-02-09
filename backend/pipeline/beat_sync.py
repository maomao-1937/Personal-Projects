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


def _build_interest_map(video: VideoAnalysis, n_bins: int = 200) -> np.ndarray:
    """Build a per-bin interest score combining motion + scene proximity."""
    dur = video.duration
    if dur <= 0:
        return np.ones(n_bins)

    bins = np.linspace(0, dur, n_bins)
    interest = np.zeros(n_bins)

    # Add motion
    for i, t in enumerate(bins):
        interest[i] = _interp(video.motion_times, video.motion_scores, t)

    # Boost scene boundaries (strong visual impact)
    for scene_t in video.scenes:
        idx = int(scene_t / dur * (n_bins - 1))
        idx = max(0, min(idx, n_bins - 1))
        # Boost a window around the scene boundary
        for j in range(max(0, idx - 3), min(n_bins, idx + 4)):
            interest[j] += 0.5

    # Normalize to 0..1
    if interest.max() > 0:
        interest = interest / interest.max()

    return interest


def compute_beat_sync_cuts(
    audio: AudioAnalysis,
    video: VideoAnalysis,
    settings: ProcessSettings,
) -> list[CutSegment]:
    agg = settings.aggressiveness / 100.0
    mb = settings.motionBias / 100.0
    beats = audio.beats
    downbeats = audio.downbeats
    vid_dur = video.duration
    aud_dur = audio.duration

    if len(beats) < 2:
        return [CutSegment(start=0.0, end=min(vid_dur, aud_dur))]

    # ================================================================
    # Step 1: Choose which beats to cut on (based on aggressiveness)
    # ================================================================
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

    candidates = np.sort(np.unique(candidates))

    # ================================================================
    # Step 2: Build the beat grid — times where visual cuts happen
    # ================================================================
    # Always start from 0 so video aligns with audio start
    min_seg = 2.0 - 1.7 * agg  # 2.0s at agg=0, 0.3s at agg=100

    beat_grid = [0.0]
    for t in candidates:
        if t <= 0.0:
            continue
        if t - beat_grid[-1] >= min_seg:
            beat_grid.append(float(t))

    # Add the audio end
    if aud_dur - beat_grid[-1] > 0.1:
        beat_grid.append(aud_dur)

    # ================================================================
    # Step 3: For each beat interval, pick WHERE in the source video
    #         to grab footage — this is what creates the "cuts" effect
    # ================================================================
    interest = _build_interest_map(video)
    n_bins = len(interest)

    # Build pool of candidate source windows sorted by interest
    # We'll pick from these to create visual variety
    window_step = 0.5  # seconds
    n_windows = int(vid_dur / window_step)
    windows = []
    for w in range(n_windows):
        t = w * window_step
        bin_idx = min(int(t / vid_dur * (n_bins - 1)), n_bins - 1)
        windows.append((t, interest[bin_idx]))

    # Sort by interest (descending) — prefer high-motion/scene-boundary areas
    windows.sort(key=lambda x: x[1], reverse=True)

    segments = []
    used_times = set()  # Track which source windows we've used (avoid repetition)

    for i in range(len(beat_grid) - 1):
        seg_duration = beat_grid[i + 1] - beat_grid[i]
        if seg_duration < 0.04:
            continue

        # Clamp segment to fit within source video
        seg_duration_clamped = min(seg_duration, vid_dur - 0.01)

        if mb < 0.3:
            # Low motionBias: prefer variety, cycle through video sequentially
            # but with jumps at each beat to create visual cuts
            src_start = _pick_sequential_with_jumps(
                i, len(beat_grid) - 1, vid_dur, seg_duration_clamped
            )
        elif mb < 0.7:
            # Medium motionBias: mix of sequential + interest-driven
            src_start = _pick_mixed(
                i, len(beat_grid) - 1, vid_dur, seg_duration_clamped,
                interest, n_bins, used_times, window_step
            )
        else:
            # High motionBias: always pick highest-interest window
            src_start = _pick_best_interest(
                vid_dur, seg_duration_clamped, interest, n_bins,
                used_times, window_step
            )

        # Clamp to valid range
        src_start = max(0.0, min(src_start, vid_dur - seg_duration_clamped))
        src_end = src_start + seg_duration_clamped

        segments.append(CutSegment(start=src_start, end=src_end))

        # Mark this window as used
        bin_key = round(src_start / window_step)
        used_times.add(bin_key)

    return segments


def _pick_sequential_with_jumps(
    seg_idx: int, total_segs: int, vid_dur: float, seg_dur: float
) -> float:
    """Spread segments across the video with non-sequential ordering.
    Creates a pattern that jumps around the video at each cut."""
    # Use golden ratio to spread picks across the video for maximum variety
    golden = (1 + 5**0.5) / 2
    phase = (seg_idx * golden) % 1.0
    return phase * max(0, vid_dur - seg_dur)


def _pick_mixed(
    seg_idx: int, total_segs: int, vid_dur: float, seg_dur: float,
    interest: np.ndarray, n_bins: int, used: set, step: float
) -> float:
    """Alternate between sequential golden-ratio picks and interest-driven picks."""
    if seg_idx % 3 == 0:
        # Every 3rd cut: pick a high-interest spot
        return _pick_best_interest(vid_dur, seg_dur, interest, n_bins, used, step)
    else:
        # Others: golden ratio spread
        return _pick_sequential_with_jumps(seg_idx, total_segs, vid_dur, seg_dur)


def _pick_best_interest(
    vid_dur: float, seg_dur: float,
    interest: np.ndarray, n_bins: int, used: set, step: float
) -> float:
    """Pick the highest-interest window that hasn't been used recently."""
    best_score = -1.0
    best_start = 0.0

    search_step = max(0.5, seg_dur / 2)
    t = 0.0
    while t + seg_dur <= vid_dur:
        bin_key = round(t / step)
        # Penalize recently used windows
        penalty = 0.5 if bin_key in used else 0.0

        bin_idx = min(int(t / vid_dur * (n_bins - 1)), n_bins - 1)
        score = interest[bin_idx] - penalty

        if score > best_score:
            best_score = score
            best_start = t
        t += search_step

    return best_start
