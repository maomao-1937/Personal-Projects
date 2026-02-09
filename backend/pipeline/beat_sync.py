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

    if len(beats) < 2 or vid_dur <= 0:
        return [CutSegment(start=0.0, end=min(vid_dur, aud_dur))]

    # ================================================================
    # Step 1: Score every beat by musical intensity
    #         (only the strongest beats trigger visual cuts)
    # ================================================================
    e_max = audio.energy_curve.max() if len(audio.energy_curve) > 0 else 1.0

    beat_scores = []
    for b in beats:
        energy = _interp(audio.energy_times, audio.energy_curve, b)
        energy_norm = energy / e_max if e_max > 0 else 0.0

        # Downbeat bonus (first beat of a bar)
        is_downbeat = any(abs(b - db) < 0.05 for db in audio.downbeats)
        downbeat_bonus = 0.4 if is_downbeat else 0.0

        # Onset strength (how sharp is the attack at this beat?)
        onset = _interp(audio.onset_times, audio.onset_env, b)
        o_max = audio.onset_env.max() if len(audio.onset_env) > 0 else 1.0
        onset_norm = onset / o_max if o_max > 0 else 0.0

        score = energy_norm * 0.4 + onset_norm * 0.3 + downbeat_bonus + 0.1
        beat_scores.append(score)

    beat_scores = np.array(beat_scores)

    # ================================================================
    # Step 2: Pick which beats to cut on
    #         Aggressiveness controls the threshold:
    #           low agg = only cut on very strong beats (few cuts)
    #           high agg = cut on most beats (many cuts)
    # ================================================================
    # Determine cut threshold — higher = fewer cuts
    if len(beat_scores) > 0:
        sorted_scores = np.sort(beat_scores)[::-1]
        # agg=0 -> keep top 15% of beats, agg=1 -> keep top 90%
        keep_fraction = 0.15 + 0.75 * agg
        threshold_idx = max(0, min(len(sorted_scores) - 1,
                                   int(keep_fraction * len(sorted_scores))))
        threshold = sorted_scores[threshold_idx]
    else:
        threshold = 0.0

    # Select beats above threshold
    cut_beat_indices = [i for i, s in enumerate(beat_scores) if s >= threshold]

    # Enforce minimum segment duration to prevent flicker
    # agg=0 -> min 4s, agg=0.5 -> min 2s, agg=1 -> min 0.5s
    min_seg = 4.0 - 3.5 * agg

    cut_times = [0.0]  # always start at 0
    for idx in cut_beat_indices:
        t = float(beats[idx])
        if t - cut_times[-1] >= min_seg:
            cut_times.append(t)

    # Add audio end
    if aud_dur - cut_times[-1] > 0.5:
        cut_times.append(aud_dur)
    else:
        cut_times[-1] = aud_dur

    # ================================================================
    # Step 3: Assign source video locations to each segment
    #         Strategy depends on motionBias:
    #           low mb = play video mostly in order (narrative feel)
    #           high mb = jump to high-motion moments
    # ================================================================
    # Build interest map for the source video
    motion_interest = _build_interest_ranking(video)

    segments = []
    video_cursor = 0.0  # where we are in the source video
    recently_used = []  # track recently jumped-to locations

    for i in range(len(cut_times) - 1):
        seg_duration = cut_times[i + 1] - cut_times[i]
        if seg_duration < 0.04:
            continue

        # Clamp to available video duration
        effective_dur = min(seg_duration, vid_dur - 0.01)

        # Decide: continue sequentially or jump?
        # At strong beats with high motionBias, we jump to interesting spots.
        # Otherwise we play sequentially for continuity.
        beat_strength = 0.0
        if i > 0:
            closest_beat_idx = min(
                range(len(beats)),
                key=lambda bi: abs(beats[bi] - cut_times[i])
            )
            beat_strength = beat_scores[closest_beat_idx]

        should_jump = (
            i > 0 and  # never jump on first segment
            beat_strength > np.percentile(beat_scores, 70) and
            mb > 0.2 and
            np.random.random() < mb  # probabilistic based on motionBias
        )

        if should_jump:
            # Jump to a high-interest location (avoid recently used spots)
            src_start = _find_interesting_start(
                motion_interest, effective_dur, vid_dur,
                video_cursor, recently_used
            )
            recently_used.append(src_start)
            # Keep only last N to allow revisiting after a while
            if len(recently_used) > max(8, len(cut_times) // 4):
                recently_used.pop(0)
        else:
            # Continue from where we left off (with wrapping)
            src_start = video_cursor
            if src_start + effective_dur > vid_dur:
                src_start = 0.0  # loop back

        # Clamp
        src_start = max(0.0, min(src_start, vid_dur - effective_dur))
        src_end = src_start + effective_dur

        segments.append(CutSegment(start=src_start, end=src_end))
        video_cursor = src_end

    return segments


def _build_interest_ranking(video: VideoAnalysis) -> list[tuple[float, float]]:
    """Build ranked list of (time, interest_score) for source video windows."""
    dur = video.duration
    if dur <= 0:
        return [(0.0, 0.5)]

    step = 0.5
    windows = []
    t = 0.0
    while t < dur:
        motion = _interp(video.motion_times, video.motion_scores, t)

        # Scene boundary proximity boost
        scene_boost = 0.0
        if video.scenes:
            nearest = min(abs(t - s) for s in video.scenes)
            if nearest < 1.0:
                scene_boost = 0.5 * (1.0 - nearest)

        score = motion + scene_boost
        windows.append((t, score))
        t += step

    return windows


def _find_interesting_start(
    interest: list[tuple[float, float]],
    seg_duration: float,
    vid_dur: float,
    avoid_time: float,
    recently_used: list[float] = None,
) -> float:
    """Find the most interesting starting point, avoiding recent locations."""
    best_start = 0.0
    best_score = -1.0
    used = recently_used or []

    for t, score in interest:
        if t + seg_duration > vid_dur:
            continue

        # Penalize locations close to current position (want a visible jump)
        proximity_penalty = 0.0
        if abs(t - avoid_time) < 5.0:
            proximity_penalty = 0.5 * (1.0 - abs(t - avoid_time) / 5.0)

        # Penalize recently used locations (prevent repetition)
        repeat_penalty = 0.0
        for used_t in used:
            if abs(t - used_t) < 4.0:
                repeat_penalty = max(repeat_penalty,
                                     0.8 * (1.0 - abs(t - used_t) / 4.0))

        adjusted = score - proximity_penalty - repeat_penalty
        if adjusted > best_score:
            best_score = adjusted
            best_start = t

    return best_start
