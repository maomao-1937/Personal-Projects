import asyncio
import os
from models import ProcessSettings, JobStatus
from job_store import update_job, append_log
from pipeline.downloader import download_youtube
from pipeline.audio_analyzer import analyze_audio
from pipeline.video_analyzer import analyze_video
from pipeline.beat_sync import compute_beat_sync_cuts
from pipeline.exporter import export_video
from config import UPLOAD_DIR


async def run_pipeline(
    job_id: str,
    video_path: str,
    audio_path: str,
    settings: ProcessSettings,
    video_url: str = "",
    audio_url: str = "",
):
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        # --- Download from YouTube if URLs provided ---
        if video_url:
            update_job(job_id, status=JobStatus.DOWNLOADING, progress=0.05)
            append_log(job_id, "> fetching video from YouTube...")
            video_path = await asyncio.to_thread(download_youtube, video_url, job_dir, "video")
            append_log(job_id, "> video downloaded.")

        if audio_url:
            update_job(job_id, status=JobStatus.DOWNLOADING, progress=0.10)
            append_log(job_id, "> fetching audio from YouTube...")
            audio_path = await asyncio.to_thread(download_youtube, audio_url, job_dir, "audio")
            append_log(job_id, "> audio downloaded.")

        # --- Analyze audio ---
        update_job(job_id, status=JobStatus.ANALYZING_AUDIO, progress=0.20)
        append_log(job_id, "> analyzing audio waveform...")
        audio_data = await asyncio.to_thread(analyze_audio, audio_path, settings.sensitivity)
        append_log(job_id, f"> detected BPM: {audio_data.bpm:.1f}, beats: {len(audio_data.beats)}")

        # --- Analyze video ---
        update_job(job_id, status=JobStatus.ANALYZING_VIDEO, progress=0.40)
        append_log(job_id, "> analyzing video scenes and motion...")
        video_data = await asyncio.to_thread(analyze_video, video_path)
        append_log(job_id, f"> found {len(video_data.scenes)} scene boundaries")

        # --- Beat-sync alignment ---
        update_job(job_id, status=JobStatus.SYNCING, progress=0.55)
        append_log(job_id, "> aligning cuts to beat grid...")
        cut_list = await asyncio.to_thread(
            compute_beat_sync_cuts, audio_data, video_data, settings
        )
        append_log(job_id, f"> generated {len(cut_list)} cut points")

        # --- Export ---
        update_job(job_id, status=JobStatus.EXPORTING, progress=0.65)
        append_log(job_id, "> encoding output (H.264)...")
        output_path = await asyncio.to_thread(
            export_video, video_path, audio_path, cut_list, job_id
        )
        append_log(job_id, "> encoding complete.")

        # --- Done ---
        update_job(job_id, status=JobStatus.COMPLETE, progress=1.0, output_file=output_path)
        append_log(job_id, "> complete.")

    except Exception as e:
        update_job(job_id, status=JobStatus.FAILED, error=str(e))
        append_log(job_id, f"> ERROR: {e}")
