"""审查模式 API。"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends

from app.api.v1.invite import verify_invite
from app.db import session_scope
from app.models.models import Job
from app.schemas.schemas import JobCreatedResponse, ReviewRequest
from app.services import runner

router = APIRouter(tags=["review"], dependencies=[Depends(verify_invite)])


@router.post("/review", response_model=JobCreatedResponse)
async def create_review(
    req: ReviewRequest, background_tasks: BackgroundTasks
):
    job_id = str(uuid.uuid4())
    with session_scope() as s:
        s.add(
            Job(
                id=job_id,
                type="review",
                prd_text=req.prd_text,
                target_url=None,
                allow_destructive=False,
                status="pending",
            )
        )
    background_tasks.add_task(runner.run_job, job_id)
    return JobCreatedResponse(job_id=job_id, status="pending")
