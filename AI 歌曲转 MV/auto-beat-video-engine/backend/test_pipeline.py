"""
End-to-end test for the beat-sync pipeline.
Downloads test media, runs analysis, generates cuts, exports, and verifies.
"""
import sys
import os
import time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import OUTPUT_DIR
from models import ProcessSettings
from pipeline.downloader import download_youtube
from pipeline.audio_analyzer import analyze_audio
from pipeline.video_analyzer import analyze_video
from pipeline.beat_sync import compute_beat_sync_cuts
from pipeline.exporter import export_video

TEST_VIDEO_URL = "https://www.youtube.com/watch?v=F8gMdWFGkFw"
TEST_AUDIO_URL = "https://www.youtube.com/watch?v=OCvsEfuTA_8"
TEST_DIR = os.path.join(os.path.dirname(__file__), "test_data")
JOB_ID = "test_run"


def step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def main():
    os.makedirs(TEST_DIR, exist_ok=True)

    # ---- Step 1: Download ----
    video_path = os.path.join(TEST_DIR, "video.mp4")
    audio_path = None

    # Check for cached files
    for ext in ["mp4", "mkv", "webm"]:
        p = os.path.join(TEST_DIR, f"video.{ext}")
        if os.path.exists(p):
            video_path = p
            break
    else:
        video_path = None

    for ext in ["wav", "mp3", "m4a", "opus"]:
        p = os.path.join(TEST_DIR, f"audio.{ext}")
        if os.path.exists(p):
            audio_path = p
            break

    if not video_path or not os.path.exists(video_path):
        step("Downloading test video")
        t0 = time.time()
        video_path = download_youtube(TEST_VIDEO_URL, TEST_DIR, "video")
        print(f"  Downloaded in {time.time()-t0:.1f}s: {video_path}")
    else:
        print(f"  Using cached video: {video_path}")

    if not audio_path or not os.path.exists(audio_path):
        step("Downloading test audio")
        t0 = time.time()
        audio_path = download_youtube(TEST_AUDIO_URL, TEST_DIR, "audio")
        print(f"  Downloaded in {time.time()-t0:.1f}s: {audio_path}")
    else:
        print(f"  Using cached audio: {audio_path}")

    # ---- Step 2: Analyze ----
    step("Analyzing audio")
    t0 = time.time()
    settings = ProcessSettings(aggressiveness=50, motionBias=50, sensitivity=50)
    audio = analyze_audio(audio_path, settings.sensitivity)
    print(f"  BPM: {audio.bpm:.1f}")
    print(f"  Beats: {len(audio.beats)}")
    print(f"  Downbeats: {len(audio.downbeats)}")
    print(f"  Duration: {audio.duration:.1f}s")
    print(f"  Time: {time.time()-t0:.1f}s")

    step("Analyzing video")
    t0 = time.time()
    video = analyze_video(video_path)
    print(f"  FPS: {video.fps:.1f}")
    print(f"  Duration: {video.duration:.1f}s")
    print(f"  Scenes: {len(video.scenes)}")
    print(f"  Motion samples: {len(video.motion_scores)}")
    print(f"  Time: {time.time()-t0:.1f}s")

    # ---- Step 3: Beat sync ----
    step("Computing beat-sync cuts")
    t0 = time.time()
    cuts = compute_beat_sync_cuts(audio, video, settings)
    elapsed = time.time() - t0
    print(f"  Segments: {len(cuts)}")
    print(f"  Time: {elapsed:.3f}s")

    # Analyze cuts quality
    durations = [c.end - c.start for c in cuts]
    print(f"\n  Clip durations:")
    print(f"    Min: {min(durations):.2f}s")
    print(f"    Max: {max(durations):.2f}s")
    print(f"    Mean: {np.mean(durations):.2f}s")
    print(f"    Median: {np.median(durations):.2f}s")

    # Check for visible jumps (source position discontinuity)
    jumps = 0
    sequential = 0
    for i in range(1, len(cuts)):
        prev_end = cuts[i-1].end
        curr_start = cuts[i].start
        gap = abs(curr_start - prev_end)
        if gap > 0.5:  # >0.5s discontinuity = visible jump
            jumps += 1
        else:
            sequential += 1

    total = jumps + sequential
    print(f"\n  Transition analysis:")
    print(f"    Jumps (visible cuts): {jumps}/{total} ({jumps/total*100:.0f}%)")
    print(f"    Sequential (no cut):  {sequential}/{total} ({sequential/total*100:.0f}%)")

    # Source video coverage
    all_times = []
    for c in cuts:
        all_times.extend([c.start, c.end])
    source_range = max(all_times) - min(all_times) if all_times else 0
    print(f"\n  Source coverage:")
    print(f"    Video duration: {video.duration:.1f}s")
    print(f"    Source range used: {min(all_times):.1f}s - {max(all_times):.1f}s ({source_range:.1f}s)")
    print(f"    Coverage: {source_range/video.duration*100:.0f}%")

    # Show first 10 segments
    print(f"\n  First 10 segments:")
    for i, c in enumerate(cuts[:10]):
        dur = c.end - c.start
        jump_marker = ""
        if i > 0:
            gap = abs(c.start - cuts[i-1].end)
            jump_marker = f" JUMP({gap:.1f}s)" if gap > 0.5 else " seq"
        print(f"    [{i:3d}] src {c.start:6.2f}s - {c.end:6.2f}s  dur={dur:.2f}s{jump_marker}")

    if jumps / total < 0.8:
        print(f"\n  WARNING: Only {jumps/total*100:.0f}% jumps. Need >=80% for visible beat sync.")
        return

    # ---- Step 4: Export ----
    step("Exporting video")
    t0 = time.time()
    output_path = export_video(video_path, audio_path, cuts, JOB_ID)
    print(f"  Output: {output_path}")
    print(f"  Time: {time.time()-t0:.1f}s")
    size_mb = os.path.getsize(output_path) / (1024*1024)
    print(f"  Size: {size_mb:.1f} MB")

    # ---- Step 5: Verify ----
    step("Running verification")
    import subprocess
    result = subprocess.run(
        [sys.executable, os.path.join(os.path.dirname(__file__), "verify_sync.py"),
         output_path, audio_path],
        capture_output=True, text=True, cwd=os.path.dirname(__file__)
    )
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr[-500:])

    print("\nDONE")


if __name__ == "__main__":
    main()
