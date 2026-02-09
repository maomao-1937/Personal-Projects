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
    """Build a single FFmpeg complex filter to trim+concat all segments, then mux audio."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp4")

    # Filter segments: skip any with zero/negative duration
    valid_cuts = [s for s in cuts if s.end - s.start >= 0.04]
    if not valid_cuts:
        raise RuntimeError("No valid segments to export")

    # For a large number of segments, use the file-based approach
    # to avoid hitting command-line length limits
    if len(valid_cuts) > 80:
        return _export_via_concat_file(video_path, audio_path, valid_cuts, job_id, output_path)

    return _export_via_filter(video_path, audio_path, valid_cuts, job_id, output_path)


def _export_via_filter(
    video_path: str,
    audio_path: str,
    cuts: list[CutSegment],
    job_id: str,
    output_path: str,
) -> str:
    """Use FFmpeg complex filter for precise segment trimming and concatenation."""
    n = len(cuts)

    # Build trim filter: for each segment, trim the input video
    filter_parts = []
    concat_inputs = []
    for i, seg in enumerate(cuts):
        duration = seg.end - seg.start
        filter_parts.append(
            f"[0:v]trim=start={seg.start:.4f}:duration={duration:.4f},"
            f"setpts=PTS-STARTPTS[v{i}]"
        )
        concat_inputs.append(f"[v{i}]")

    # Concat all trimmed segments
    concat_str = "".join(concat_inputs)
    filter_parts.append(f"{concat_str}concat=n={n}:v=1:a=0[outv]")

    filter_complex = ";".join(filter_parts)

    cmd = [
        FFMPEG_BIN, "-y",
        "-i", video_path,
        "-i", audio_path,
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Export failed: {result.stderr[-500:]}")

    return output_path


def _export_via_concat_file(
    video_path: str,
    audio_path: str,
    cuts: list[CutSegment],
    job_id: str,
    output_path: str,
) -> str:
    """For many segments, encode each then concat (avoids filter_complex limits)."""
    import shutil

    job_temp = os.path.join(OUTPUT_DIR, f"{job_id}_temp")
    os.makedirs(job_temp, exist_ok=True)

    segment_files = []

    for i, seg in enumerate(cuts):
        out_seg = os.path.join(job_temp, f"seg_{i:04d}.mp4")
        duration = seg.end - seg.start
        cmd = [
            FFMPEG_BIN, "-y",
            "-ss", f"{seg.start:.4f}",
            "-i", video_path,
            "-t", f"{duration:.4f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-an",
            "-video_track_timescale", "90000",
            out_seg,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Segment {i} encode failed: {result.stderr[-300:]}")
        segment_files.append(out_seg)

    if not segment_files:
        raise RuntimeError("No segments to concatenate")

    # Write concat list
    concat_list = os.path.join(job_temp, "concat.txt")
    with open(concat_list, "w") as f:
        for sf in segment_files:
            safe_path = sf.replace("\\", "/")
            f.write(f"file '{safe_path}'\n")

    # Concatenate video segments
    video_only = os.path.join(job_temp, "video_only.mp4")
    cmd = [
        FFMPEG_BIN, "-y",
        "-f", "concat", "-safe", "0", "-i", concat_list,
        "-c", "copy",
        "-video_track_timescale", "90000",
        video_only,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Concat failed: {result.stderr[-300:]}")

    # Mux with audio
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

    shutil.rmtree(job_temp, ignore_errors=True)
    return output_path
