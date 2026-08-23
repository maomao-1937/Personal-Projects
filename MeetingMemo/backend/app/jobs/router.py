from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.access.dependencies import require_access_session
from app.jobs.schemas import ProcessingJobResponse
from app.summaries.service import SummaryService

router = APIRouter(
    prefix="/api/v1/jobs",
    tags=["jobs"],
    dependencies=[Depends(require_access_session)],
)


def get_summary_service(request: Request) -> SummaryService:
    return SummaryService(request.app.state.session_factory)


@router.get("/{job_id}", response_model=ProcessingJobResponse)
def read_job(
    job_id: str,
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> ProcessingJobResponse:
    return ProcessingJobResponse.from_model(service.get_job(job_id))


@router.post("/{job_id}/retry", response_model=ProcessingJobResponse)
def retry_job(
    job_id: str,
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> ProcessingJobResponse:
    return ProcessingJobResponse.from_model(service.retry_job(job_id))
