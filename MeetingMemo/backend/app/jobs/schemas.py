from datetime import datetime

from pydantic import BaseModel

from app.jobs.models import ProcessingJob


class JobErrorResponse(BaseModel):
    code: str
    message: str


class ProcessingJobResponse(BaseModel):
    id: str
    meeting_id: str
    job_type: str
    status: str
    attempts: int
    max_attempts: int
    error: JobErrorResponse | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, job: ProcessingJob) -> "ProcessingJobResponse":
        error = (
            JobErrorResponse(code=job.error_code, message=job.error_message or "处理失败")
            if job.error_code
            else None
        )
        return cls(
            id=job.id,
            meeting_id=job.meeting_id,
            job_type=job.job_type,
            status=job.status,
            attempts=job.attempts,
            max_attempts=job.max_attempts,
            error=error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
