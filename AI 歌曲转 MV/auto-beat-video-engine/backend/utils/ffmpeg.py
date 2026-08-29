import json
import subprocess
from config import FFMPEG_BIN, FFPROBE_BIN


def run_ffmpeg(args: list[str], description: str = "") -> str:
    result = subprocess.run(
        [FFMPEG_BIN] + args,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed ({description}): {result.stderr[-500:]}")
    return result.stderr


def get_video_info(video_path: str) -> tuple[float, float]:
    """Returns (fps, duration) for the video."""
    result = subprocess.run([
        FFPROBE_BIN, "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", video_path
    ], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    data = json.loads(result.stdout)

    fps = 30.0
    duration = 0.0

    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            r = stream.get("r_frame_rate", "30/1")
            num, den = r.split("/")
            fps = float(num) / float(den) if float(den) != 0 else 30.0
            duration = float(stream.get("duration", 0))
            break

    if duration == 0:
        duration = float(data.get("format", {}).get("duration", 0))

    return fps, duration
