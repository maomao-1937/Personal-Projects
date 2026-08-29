from dataclasses import dataclass
import re
import subprocess
import struct
import numpy as np
from config import FFMPEG_BIN, FFPROBE_BIN
from utils.ffmpeg import get_video_info


@dataclass
class VideoAnalysis:
    scenes: list[float]
    motion_scores: np.ndarray
    motion_times: np.ndarray
    fps: float
    duration: float


def detect_scenes(video_path: str, threshold: float = 0.3) -> list[float]:
    """Detect scene changes using ffmpeg's select filter."""
    cmd = [
        FFMPEG_BIN, "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr", "-f", "null", "NUL",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    scenes = []
    for line in result.stderr.split("\n"):
        m = re.search(r"pts_time:\s*([\d.]+)", line)
        if m:
            scenes.append(float(m.group(1)))
    return scenes


def compute_motion(video_path: str, sample_fps: int = 2) -> tuple[np.ndarray, np.ndarray]:
    """Compute per-second motion intensity by frame differencing at low FPS."""
    # Get video dimensions
    probe = subprocess.run([
        FFPROBE_BIN, "-v", "quiet", "-print_format", "json",
        "-show_streams", video_path
    ], capture_output=True, text=True)

    import json
    info = json.loads(probe.stdout)
    width, height = 320, 180  # decode at low res for speed
    for s in info.get("streams", []):
        if s.get("codec_type") == "video":
            break

    # Decode grayscale frames at low res and FPS
    cmd = [
        FFMPEG_BIN, "-i", video_path,
        "-vf", f"fps={sample_fps},scale={width}:{height},format=gray",
        "-f", "rawvideo", "-pix_fmt", "gray",
        "pipe:1",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    frame_size = width * height
    prev_frame = None
    scores = []

    while True:
        raw = proc.stdout.read(frame_size)
        if len(raw) < frame_size:
            break
        frame = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
        if prev_frame is not None:
            diff = np.mean(np.abs(frame - prev_frame)) / 255.0
            scores.append(diff)
        else:
            scores.append(0.0)
        prev_frame = frame

    proc.wait()

    scores = np.array(scores)
    if len(scores) > 0 and scores.max() > 0:
        scores = scores / scores.max()  # normalize to 0..1

    times = np.arange(len(scores)) / sample_fps
    return scores, times


def analyze_video(video_path: str) -> VideoAnalysis:
    fps, duration = get_video_info(video_path)
    scenes = detect_scenes(video_path)
    motion_scores, motion_times = compute_motion(video_path)

    return VideoAnalysis(
        scenes=scenes,
        motion_scores=motion_scores,
        motion_times=motion_times,
        fps=fps,
        duration=duration,
    )
