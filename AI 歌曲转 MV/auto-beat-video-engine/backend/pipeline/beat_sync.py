from dataclasses import dataclass
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


def compute_beat_sync_cuts(
    audio: AudioAnalysis,
    video: VideoAnalysis,
    settings: ProcessSettings,
) -> list[CutSegment]:
    agg = settings.aggressiveness / 100.0
    mb = settings.motionBias / 100.0
    beats = audio.beats
    vid_dur = video.duration
    aud_dur = audio.duration
    fps = video.fps if video.fps > 0 else 30.0
    frame_dur = 1.0 / fps  # duration of one frame

    if len(beats) < 2 or vid_dur <= 0:
        return [CutSegment(start=0.0, end=min(vid_dur, aud_dur))]

    # ================================================================
    # Step 1: Score every beat by musical intensity
    # ================================================================
    e_max = audio.energy_curve.max() if len(audio.energy_curve) > 0 else 1.0
    o_max = audio.onset_env.max() if len(audio.onset_env) > 0 else 1.0

    beat_scores = []
    for b in beats:
        energy = _interp(audio.energy_times, audio.energy_curve, b)
        energy_norm = energy / e_max if e_max > 0 else 0.0

        is_downbeat = any(abs(b - db) < 0.05 for db in audio.downbeats)
        downbeat_bonus = 0.4 if is_downbeat else 0.0

        onset = _interp(audio.onset_times, audio.onset_env, b)
        onset_norm = onset / o_max if o_max > 0 else 0.0

        score = energy_norm * 0.4 + onset_norm * 0.3 + downbeat_bonus + 0.1
        beat_scores.append(score)

    beat_scores = np.array(beat_scores)

    # ================================================================
    # Step 2: Pick which beats to cut on
    #   agg=0 -> cut on ~15% of beats (only strongest), min gap 4s
    #   agg=0.5 -> cut on ~50% of beats, min gap 2s
    #   agg=1 -> cut on ~90% of beats, min gap 0.5s
    # ================================================================
    sorted_scores = np.sort(beat_scores)[::-1]
    keep_fraction = 0.15 + 0.75 * agg
    threshold_idx = min(len(sorted_scores) - 1, int(keep_fraction * len(sorted_scores)))
    threshold = sorted_scores[threshold_idx]

    min_seg = 4.0 - 3.5 * agg

    cut_times = [0.0]
    for i, s in enumerate(beat_scores):
        if s >= threshold:
            t = float(beats[i])
            if t - cut_times[-1] >= min_seg:
                cut_times.append(t)

    if aud_dur - cut_times[-1] > 0.5:
        cut_times.append(aud_dur)
    else:
        cut_times[-1] = aud_dur

    # Snap cut times to the frame grid so each segment's duration is an
    # exact multiple of frame_dur. This prevents per-segment rounding
    # errors from accumulating into visible drift over many segments.
    cut_times = [round(t / frame_dur) * frame_dur for t in cut_times]

    # ================================================================
    # Step 3: Assign source video clips to each segment
    #
    # KEY RULE: Every segment jumps to a DIFFERENT part of the source
    # video. This is what makes it feel beat-synced — you SEE a
    # visual change at every beat point.
    #
    # motionBias controls WHERE we jump:
    #   low mb  -> spread evenly across source (show everything)
    #   high mb -> prefer high-motion / scene-change moments
    # ================================================================
    n_segs = len(cut_times) - 1
    if n_segs == 0:
        return [CutSegment(start=0.0, end=min(vid_dur, aud_dur))]

    # Build pool of source windows ranked by interest
    interest_map = _build_interest_map(video, vid_dur)

    # Pre-compute segment durations
    seg_durations = []
    for i in range(n_segs):
        dur = cut_times[i + 1] - cut_times[i]
        seg_durations.append(min(dur, vid_dur - 0.01))

    # Assign source positions: spread across video, biased by interest
    segments = []
    used_starts = []

    for i in range(n_segs):
        effective_dur = seg_durations[i]
        if effective_dur < 0.04:
            continue

        # Pick source location
        src_start = _pick_source_location(
            i, n_segs, effective_dur, vid_dur, mb,
            interest_map, used_starts
        )

        src_start = max(0.0, min(src_start, vid_dur - effective_dur))
        # Snap source times to frame grid for precise trim
        src_start = round(src_start / frame_dur) * frame_dur
        src_end = src_start + effective_dur

        segments.append(CutSegment(start=src_start, end=src_end))
        used_starts.append(src_start)

    return segments


def _build_interest_map(video: VideoAnalysis, vid_dur: float) -> np.ndarray:
    """Build an interest score array sampled at 0.5s intervals."""
    step = 0.5
    n = max(1, int(vid_dur / step))
    interest = np.zeros(n)

    for i in range(n):
        t = i * step
        motion = _interp(video.motion_times, video.motion_scores, t)
        interest[i] = motion

        # Scene boundary boost
        if video.scenes:
            nearest = min(abs(t - s) for s in video.scenes)
            if nearest < 1.0:
                interest[i] += 0.5 * (1.0 - nearest)

    # Normalize
    if interest.max() > 0:
        interest = interest / interest.max()

    return interest


def _pick_source_location(
    seg_idx: int,
    total_segs: int,
    seg_dur: float,
    vid_dur: float,
    motion_bias: float,
    interest: np.ndarray,
    used_starts: list[float],
) -> float:
    """Pick a source location that's visually different from the previous clip.

    Uses a blend of even-spread (golden ratio) and interest-weighted selection.
    Every call returns a location far from the previous one to ensure a visible cut.
    """
    step = 0.5
    max_start = vid_dur - seg_dur
    if max_start <= 0:
        return 0.0

    # Base position: golden ratio spread ensures even coverage
    golden = (1 + 5**0.5) / 2
    base = ((seg_idx * golden) % 1.0) * max_start

    # If motionBias is low, just use the golden spread
    if motion_bias < 0.2:
        return _ensure_jump(base, max_start, vid_dur, used_starts, seg_dur)

    # Otherwise, search nearby the base for a high-interest spot
    # Higher motionBias = wider search radius = more interest-driven
    search_radius = motion_bias * max_start * 0.5  # up to half the video

    best_start = base
    best_score = -999.0

    search_step = max(0.5, seg_dur / 3)
    t = max(0.0, base - search_radius)
    while t <= min(max_start, base + search_radius):
        bin_idx = min(int(t / step), len(interest) - 1)
        score = interest[bin_idx]

        # Penalize being too close to previous clip (ensure visible jump)
        if used_starts:
            prev = used_starts[-1]
            dist = abs(t - prev)
            if dist < 3.0:
                score -= 2.0 * (1.0 - dist / 3.0)

        # Light penalty for recent reuse
        for u in used_starts[-6:]:
            if abs(t - u) < 2.0:
                score -= 0.3

        if score > best_score:
            best_score = score
            best_start = t

        t += search_step

    return _ensure_jump(best_start, max_start, vid_dur, used_starts, seg_dur)


def _ensure_jump(
    proposed: float,
    max_start: float,
    vid_dur: float,
    used_starts: list[float],
    seg_dur: float,
) -> float:
    """If the proposed start is too close to the previous clip, force a jump."""
    if not used_starts:
        return proposed

    prev_end = used_starts[-1] + seg_dur
    # If proposed start is within 1s of where previous clip ended = no visible cut
    if abs(proposed - prev_end) < 1.0:
        # Jump to the opposite side of the video
        if proposed < vid_dur / 2:
            proposed = min(max_start, proposed + vid_dur / 2)
        else:
            proposed = max(0.0, proposed - vid_dur / 2)

    return max(0.0, min(proposed, max_start))
