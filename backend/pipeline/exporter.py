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
    """Re-encode segments, concatenate, mux with audio, produce final MP4."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    job_temp = os.path.join(OUTPUT_DIR, f"{job_id}_temp")
    os.makedirs(job_temp, exist_ok=True)

    segment_files = []

    # Step 1: Trim each segment (re-encode for frame-accurate cuts)
    for i, seg in enumerate(cuts):
        out_seg = os.path.join(job_temp, f"seg_{i:04d}.mp4")
        duration = seg.end - seg.start
        if duration <= 0:
            continue
        cmd = [
            FFMPEG_BIN, "-y",
            "-ss", f"{seg.start:.3f}",
            "-i", video_path,
            "-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-an",  # no audio in segments
            "-movflags", "+faststart",
            out_seg,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Segment {i} encode failed: {result.stderr[-300:]}")
        segment_files.append(out_seg)

    if not segment_files:
        raise RuntimeError("No segments to concatenate")

    # Step 2: Write concat list
    concat_list = os.path.join(job_temp, "concat.txt")
    with open(concat_list, "w") as f:
        for sf in segment_files:
            # Use forward slashes for ffmpeg on Windows
            safe_path = sf.replace("\\", "/")
            f.write(f"file '{safe_path}'\n")

    # Step 3: Concatenate segments
    video_only = os.path.join(job_temp, "video_only.mp4")
    cmd = [
        FFMPEG_BIN, "-y",
        "-f", "concat", "-safe", "0", "-i", concat_list,
        "-c", "copy",
        video_only,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Concat failed: {result.stderr[-300:]}")

    # Step 4: Mux with audio
    output_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")
    cmd = [
        FFMPEG_BIN, "-y",
        "-i", video_only,
        "-i", audio_path,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Mux failed: {result.stderr[-300:]}")

    # Step 5: Cleanup temp
    import shutil
    shutil.rmtree(job_temp, ignore_errors=True)

    return output_path
