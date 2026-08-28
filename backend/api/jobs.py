from __future__ import annotations

import asyncio
import json
from dataclasses import asdict

from fastapi import APIRouter, Header, Query
from fastapi.responses import StreamingResponse

from backend.domain.states import TERMINAL_JOB_STATUSES
from backend.jobs.service import JobService


def build_jobs_router(
    jobs: JobService,
    *,
    poll_interval_seconds: float = 0.25,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

    @router.get("/{job_id}")
    def get_job(job_id: str) -> dict[str, object]:
        return asdict(jobs.get(job_id))

    @router.get("/{job_id}/events")
    def get_events(job_id: str, after: int = Query(default=0, ge=0)) -> dict[str, object]:
        jobs.get(job_id)
        return {"items": [asdict(event) for event in jobs.events(job_id, after=after)]}

    @router.get("/{job_id}/stream")
    def stream_events(
        job_id: str,
        after: int = Query(default=0, ge=0),
        last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    ) -> StreamingResponse:
        jobs.get(job_id)
        cursor = after
        if last_event_id and last_event_id.isdigit():
            cursor = max(cursor, int(last_event_id))

        async def generate():
            nonlocal cursor
            while True:
                events = jobs.events(job_id, after=cursor)
                for event in events:
                    cursor = event.sequence
                    payload = asdict(event)
                    yield f"id: {event.sequence}\nevent: {event.event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                current = jobs.get(job_id)
                if current.status in {status.value for status in TERMINAL_JOB_STATUSES}:
                    break
                if not events:
                    yield ": keepalive\n\n"
                await asyncio.sleep(poll_interval_seconds)

        return StreamingResponse(generate(), media_type="text/event-stream")

    return router
