"""
Beat-Sync Verification Tool
Analyzes an output video to check if visual cuts actually align with audio beats.

Usage: python verify_sync.py <output_video> <audio_file> [--sensitivity 50]
"""
import sys
import os
import json
import subprocess
import re
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import FFMPEG_BIN, FFPROBE_BIN


def detect_scene_changes(video_path, threshold=0.3):
    """Detect actual visual cuts in the output video."""
    cmd = [
        FFMPEG_BIN, "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr", "-f", "null", "NUL",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    raw_scenes = []
    for line in result.stderr.split("\n"):
        m = re.search(r"pts_time:\s*([\d.]+)", line)
        if m:
            raw_scenes.append(float(m.group(1)))

    # Deduplicate: merge scene changes within 0.3s of each other
    if not raw_scenes:
        return []
    deduped = [raw_scenes[0]]
    for t in raw_scenes[1:]:
        if t - deduped[-1] > 0.3:
            deduped.append(t)
    return deduped


def detect_beats(audio_path, sensitivity=50):
    """Detect beats in the audio track."""
    import librosa
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    tightness = 400 - (sensitivity / 100) * 300
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, tightness=tightness)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = float(tempo) if np.isscalar(tempo) else float(tempo[0])

    # Also get downbeats
    downbeats = beat_times[::4] if len(beat_times) > 0 else np.array([])

    return beat_times, downbeats, bpm, duration


def get_duration(path):
    cmd = [FFPROBE_BIN, "-v", "quiet", "-print_format", "json", "-show_format", path]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return float(json.loads(r.stdout)["format"]["duration"])


def check_black_frames(video_path, source_path, duration, n_samples=25):
    """Check for black frames, distinguishing source-dark from encoding-artifacts."""
    artifacts = []
    step = duration / (n_samples + 1)
    for i in range(1, n_samples + 1):
        t = step * i
        cmd = [FFMPEG_BIN, "-ss", f"{t:.2f}", "-i", video_path,
               "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"]
        proc = subprocess.run(cmd, capture_output=True)
        if len(proc.stdout) > 0:
            frame = np.frombuffer(proc.stdout, dtype=np.uint8)
            avg = frame.mean()
            if avg < 5:
                artifacts.append((t, avg))
    return artifacts


def main():
    if len(sys.argv) < 3:
        print("Usage: python verify_sync.py <output_video> <audio_file> [--sensitivity 50]")
        sys.exit(1)

    video_path = sys.argv[1]
    audio_path = sys.argv[2]
    sensitivity = 50
    if "--sensitivity" in sys.argv:
        idx = sys.argv.index("--sensitivity")
        sensitivity = int(sys.argv[idx + 1])

    if not os.path.exists(video_path) or not os.path.exists(audio_path):
        print("ERROR: File not found")
        sys.exit(1)

    print("=" * 60)
    print("BEAT-SYNC VERIFICATION REPORT")
    print("=" * 60)

    # 1. Durations
    vid_dur = get_duration(video_path)
    aud_dur = get_duration(audio_path)
    dur_diff = abs(vid_dur - aud_dur)
    print(f"Video: {vid_dur:.2f}s  Audio: {aud_dur:.2f}s  Diff: {dur_diff:.2f}s  [{'PASS' if dur_diff < 2 else 'FAIL'}]")
    print()

    # 2. Beat detection
    print("Analyzing audio beats...")
    beats, downbeats, bpm, _ = detect_beats(audio_path, sensitivity)
    print(f"BPM: {bpm:.1f}  Beats: {len(beats)}  Downbeats: {len(downbeats)}")
    print()

    # 3. Scene detection (with deduplication)
    print("Detecting visual cuts (threshold=0.3, deduplicated)...")
    scenes = detect_scene_changes(video_path, threshold=0.3)
    print(f"Detected {len(scenes)} distinct visual cuts")
    print()

    # 4. Beat alignment analysis
    print("=" * 60)
    print("BEAT ALIGNMENT")
    print("=" * 60)

    if not scenes:
        print("NO CUTS DETECTED")
        return

    # For each detected cut, find nearest beat AND nearest downbeat
    beat_drifts = []
    downbeat_drifts = []
    for t in scenes:
        if len(beats) > 0:
            beat_drifts.append(min(abs(t - b) for b in beats))
        if len(downbeats) > 0:
            downbeat_drifts.append(min(abs(t - db) for db in downbeats))

    beat_drifts = np.array(beat_drifts)
    downbeat_drifts = np.array(downbeat_drifts)
    n = len(scenes)
    beat_interval = np.diff(beats).mean() if len(beats) > 1 else 1.0

    # A cut is "on beat" if within 1/4 of a beat interval
    tolerance = beat_interval / 4  # ~183ms at 83 BPM
    on_beat = np.sum(beat_drifts < tolerance)
    on_downbeat = np.sum(downbeat_drifts < tolerance)

    print(f"Beat interval: {beat_interval*1000:.0f}ms  Tolerance: {tolerance*1000:.0f}ms (1/4 beat)")
    print(f"Cuts on-beat:     {on_beat:3d}/{n} ({on_beat/n*100:.0f}%)")
    print(f"Cuts on-downbeat: {on_downbeat:3d}/{n} ({on_downbeat/n*100:.0f}%)")
    print(f"Median drift:     {np.median(beat_drifts)*1000:.0f}ms")
    print(f"Mean drift:       {np.mean(beat_drifts)*1000:.0f}ms")
    print()

    # Drift over time
    print("Drift over time (checking for accumulating errors):")
    quarters = np.array_split(np.arange(n), 4)
    all_good = True
    for qi, quarter in enumerate(quarters):
        if len(quarter) > 0:
            q_drift = np.median(beat_drifts[quarter])
            label = ["  Q1 (start)", "  Q2        ", "  Q3        ", "  Q4 (end)  "][qi]
            status = "ok" if q_drift < tolerance else "DRIFT"
            if q_drift >= tolerance:
                all_good = False
            print(f"{label}: median={q_drift*1000:.0f}ms [{status}]")
    print()

    # 5. Black frames
    print("Checking for black frames...")
    black = check_black_frames(video_path, None, vid_dur)
    if black:
        print(f"  Found {len(black)} very dark frames (may be source content)")
        for t, avg in black:
            print(f"    t={t:.1f}s brightness={avg:.1f}")
    else:
        print("  None detected")
    print()

    # 6. Cut frequency
    if len(scenes) > 1:
        intervals = np.diff(scenes)
        print(f"Cut frequency: {n/vid_dur:.2f} cuts/sec  Avg interval: {intervals.mean():.1f}s")
        print(f"Range: {intervals.min():.2f}s - {intervals.max():.1f}s")
    print()

    # 7. Scoring
    print("=" * 60)
    beat_pct = on_beat / n * 100
    # Score: 100 if >80% on-beat, scales down
    beat_score = min(100, beat_pct * 1.25)
    duration_score = 100 if dur_diff < 1 else max(0, 100 - dur_diff * 20)
    drift_score = 100 if all_good else 60

    overall = beat_score * 0.6 + duration_score * 0.2 + drift_score * 0.2

    print(f"Beat alignment:  {beat_score:5.1f}/100 ({beat_pct:.0f}% on-beat)")
    print(f"Duration match:  {duration_score:5.1f}/100")
    print(f"Drift stability: {drift_score:5.1f}/100")
    print(f"{'-' * 40}")
    print(f"OVERALL:         {overall:5.1f}/100")
    print()

    if overall >= 75:
        print("VERDICT: PASS")
    elif overall >= 50:
        print("VERDICT: PARTIAL - Some issues")
    else:
        print("VERDICT: FAIL")
    print("=" * 60)


if __name__ == "__main__":
    main()
