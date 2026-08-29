import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from job_store import get_job

router = APIRouter()


@router.get("/download/{job_id}")
async def download_result(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if job.status.value != "complete":
        raise HTTPException(400, f"Job is not complete (status: {job.status.value})")

    if not job.output_file or not os.path.isfile(job.output_file):
        raise HTTPException(404, "Output file not found")

    return FileResponse(
        path=job.output_file,
        media_type="video/mp4",
        filename=f"beat_sync_{job_id}.mp4",
    )
