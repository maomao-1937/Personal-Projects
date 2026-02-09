import os
import subprocess
from config import FFMPEG_BIN, OUTPUT_DIR
from pipeline.beat_sync import CutSegment


def export_video(
    video_path: str,
    audio_path: str,
    cuts: list[CutSegment],
    job_id: str,
) -> str:
    """Export beat-synced video using a single FFmpeg filter_complex pass."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")

    # Filter out invalid segments
    valid_cuts = [s for s in cuts if s.end - s.start >= 0.04]
    if not valid_cuts:
        raise RuntimeError("No valid segments to export")

    # Always use filter_complex via file for frame-accurate cuts with no drift.
    # Write the filter to a file to avoid command-line length limits.
    job_temp = os.path.join(OUTPUT_DIR, f"{job_id}_temp")
    os.makedirs(job_temp, exist_ok=True)

    filter_path = os.path.join(job_temp, "filter.txt")
    n = len(valid_cuts)

    # Build the filter graph
    filter_parts = []
    concat_inputs = []
    for i, seg in enumerate(valid_cuts):
        duration = seg.end - seg.start
        filter_parts.append(
            f"[0:v]trim=start={seg.start:.4f}:duration={duration:.4f},"
            f"setpts=PTS-STARTPTS[v{i}]"
        )
        concat_inputs.append(f"[v{i}]")

    concat_str = "".join(concat_inputs)
    filter_parts.append(f"{concat_str}concat=n={n}:v=1:a=0[outv]")

    filter_text = ";\n".join(filter_parts)

    with open(filter_path, "w") as f:
        f.write(filter_text)

    cmd = [
        FFMPEG_BIN, "-y",
        "-i", video_path,
        "-i", audio_path,
        "-filter_complex_script", filter_path,
        "-map", "[outv]",
        "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    # Cleanup temp
    import shutil
    shutil.rmtree(job_temp, ignore_errors=True)

    if result.returncode != 0:
        raise RuntimeError(f"Export failed: {result.stderr[-500:]}")

    return output_path
