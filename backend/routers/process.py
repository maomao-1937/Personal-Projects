import asyncio
import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from models import ProcessSettings, ProcessResponse
from job_store import create_job
from pipeline.orchestrator import run_pipeline
from config import UPLOAD_DIR, MAX_UPLOAD_SIZE

router = APIRouter()


@router.post("/process", response_model=ProcessResponse)
async def start_processing(
    video: UploadFile | None = File(None),
    audio: UploadFile | None = File(None),
    videoUrl: str = Form(""),
    audioUrl: str = Form(""),
    aggressiveness: int = Form(50),
    motionBias: int = Form(50),
    sensitivity: int = Form(50),
):
    has_video = (video and video.filename) or videoUrl.strip()
    has_audio = (audio and audio.filename) or audioUrl.strip()

    if not has_video:
        raise HTTPException(400, "Provide a video file or YouTube URL")
    if not has_audio:
        raise HTTPException(400, "Provide an audio file or YouTube URL")

    settings = ProcessSettings(
        aggressiveness=aggressiveness,
        motionBias=motionBias,
        sensitivity=sensitivity,
    )

    job_id = create_job()
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    video_path = ""
    audio_path = ""

    # Save uploaded files
    if video and video.filename:
        video_path = os.path.join(job_dir, f"input_video{_ext(video.filename)}")
        await _save_upload(video, video_path)

    if audio and audio.filename:
        audio_path = os.path.join(job_dir, f"input_audio{_ext(audio.filename)}")
        await _save_upload(audio, audio_path)

    # Launch pipeline in background
    asyncio.create_task(
        run_pipeline(
            job_id=job_id,
            video_path=video_path,
            audio_path=audio_path,
            settings=settings,
            video_url=videoUrl.strip(),
            audio_url=audioUrl.strip(),
        )
    )

    return ProcessResponse(job_id=job_id, message="Processing started")


def _ext(filename: str) -> str:
    _, ext = os.path.splitext(filename)
    return ext or ".mp4"


async def _save_upload(upload: UploadFile, dest: str):
    size = 0
    with open(dest, "wb") as f:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_SIZE:
                f.close()
                os.remove(dest)
                raise HTTPException(413, "File too large (max 2 GB)")
            f.write(chunk)
