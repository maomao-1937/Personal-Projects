"""验收模式 API。"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends

from app.api.v1.invite import verify_invite
from app.core.errors import AppError
from app.db import session_scope
from app.models.models import Job
from app.schemas.schemas import AcceptanceRequest, JobCreatedResponse
from app.services import runner

router = APIRouter(tags=["acceptance"], dependencies=[Depends(verify_invite)])


@router.post("/acceptance", response_model=JobCreatedResponse)
async def create_acceptance(
    req: AcceptanceRequest, background_tasks: BackgroundTasks
):
    if not req.target_url.startswith(("http://", "https://")):
        raise AppError(
            "validation_error", "target_url 必须以 http(s):// 开头", 422
        )
    job_id = str(uuid.uuid4())
    with session_scope() as s:
        s.add(
            Job(
                id=job_id,
                type="acceptance",
                prd_text=req.prd_text,
                target_url=req.target_url,
                allow_destructive=req.allow_destructive,
                status="pending",
            )
        )
    background_tasks.add_task(runner.run_job, job_id)
    return JobCreatedResponse(job_id=job_id, status="pending")
