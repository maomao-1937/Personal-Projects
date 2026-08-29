import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from job_store import get_job

router = APIRouter()


@router.get("/status/{job_id}")
async def stream_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    async def event_generator():
        # Send current state first (replay existing logs)
        for log_line in job.logs:
            data = json.dumps({
                "status": job.status.value,
                "progress": job.progress,
                "log": log_line,
                "error": job.error,
            })
            yield f"data: {data}\n\n"

        # Stream new events from the queue
        while True:
            try:
                event = await asyncio.wait_for(job.queue.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"

                # Stop streaming on terminal states
                if event.get("status") in ("complete", "failed"):
                    # Send output_file info on completion
                    if event.get("status") == "complete" and job.output_file:
                        final = json.dumps({
                            "status": "complete",
                            "progress": 1.0,
                            "log": "> complete.",
                            "output_file": job.output_file,
                        })
                        yield f"data: {final}\n\n"
                    break
            except asyncio.TimeoutError:
                # Send keepalive
                yield ": keepalive\n\n"

                # Check if job finished while we were waiting
                if job.status.value in ("complete", "failed"):
                    final = json.dumps({
                        "status": job.status.value,
                        "progress": job.progress,
                        "log": f"> {job.status.value}.",
                        "error": job.error,
                    })
                    yield f"data: {final}\n\n"
                    break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
