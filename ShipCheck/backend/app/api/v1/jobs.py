"""Job 查询 API。"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db import get_db
from app.models.models import Job
from app.schemas.schemas import JobListResponse, JobOut

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise AppError("not_found", f"Job 不存在: {job_id}", 404)
    # session 内触发关系懒加载,供 Pydantic 序列化
    _ = job.checklist_items
    _ = job.findings
    return job


@router.get("/jobs", response_model=JobListResponse)
def list_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Job).order_by(Job.created_at.desc())
    total = q.count()
    jobs = q.offset(offset).limit(limit).all()
    # 列表不带 checklist/findings,避免 N+1
    out = [
        JobOut(
            id=j.id,
            type=j.type,
            target_url=j.target_url,
            allow_destructive=j.allow_destructive,
            status=j.status,
            error_message=j.error_message,
            created_at=j.created_at,
            started_at=j.started_at,
            finished_at=j.finished_at,
            checklist_items=[],
            findings=[],
        )
        for j in jobs
    ]
    return JobListResponse(total=total, jobs=out)
