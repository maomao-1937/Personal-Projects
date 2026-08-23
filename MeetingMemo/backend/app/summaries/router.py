from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.access.dependencies import require_access_session
from app.access.models import AccessSession
from app.jobs.schemas import ProcessingJobResponse
from app.summaries.exporters import export_json, export_markdown, export_text
from app.summaries.schemas import (
    SummaryListResponse,
    SummaryRevisionRequest,
    SummaryVersionResponse,
)
from app.summaries.service import SummaryService

router = APIRouter(tags=["summaries"], dependencies=[Depends(require_access_session)])


def get_summary_service(request: Request) -> SummaryService:
    return SummaryService(request.app.state.session_factory)


@router.post(
    "/api/v1/meetings/{meeting_id}/summary-jobs",
    response_model=ProcessingJobResponse,
    status_code=202,
)
def create_summary_job(
    meeting_id: str,
    request: Request,
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> ProcessingJobResponse:
    job = service.create_job(meeting_id, trace_id=request.state.trace_id)
    return ProcessingJobResponse.from_model(job)


@router.get(
    "/api/v1/meetings/{meeting_id}/summaries",
    response_model=SummaryListResponse,
)
def list_summaries(
    meeting_id: str,
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> SummaryListResponse:
    return SummaryListResponse(
        items=[
            SummaryVersionResponse.model_validate(item)
            for item in service.list_versions(meeting_id)
        ]
    )


@router.get("/api/v1/summaries/{summary_id}", response_model=SummaryVersionResponse)
def read_summary(
    summary_id: str,
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> SummaryVersionResponse:
    return SummaryVersionResponse.model_validate(service.get_version(summary_id))


@router.post(
    "/api/v1/summaries/{summary_id}/revisions",
    response_model=SummaryVersionResponse,
    status_code=201,
)
def create_revision(
    summary_id: str,
    payload: SummaryRevisionRequest,
    request: Request,
    access_session: Annotated[AccessSession, Depends(require_access_session)],
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> SummaryVersionResponse:
    revision = service.create_revision(
        summary_id,
        expected_version=payload.expected_version,
        content=payload.content,
        session_fingerprint=access_session.token_hash,
        trace_id=request.state.trace_id,
    )
    return SummaryVersionResponse.model_validate(revision)


@router.post(
    "/api/v1/summaries/{summary_id}/approve",
    response_model=SummaryVersionResponse,
)
def approve_summary(
    summary_id: str,
    request: Request,
    access_session: Annotated[AccessSession, Depends(require_access_session)],
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> SummaryVersionResponse:
    return SummaryVersionResponse.model_validate(
        service.approve(
            summary_id,
            session_fingerprint=access_session.token_hash,
            trace_id=request.state.trace_id,
        )
    )


@router.get("/api/v1/summaries/{summary_id}/export")
def export_summary(
    summary_id: str,
    export_format: Annotated[Literal["markdown", "json", "text"], Query(alias="format")],
    service: Annotated[SummaryService, Depends(get_summary_service)],
) -> Response:
    meeting, stored_summary, _segments = service.export_bundle(summary_id)
    summary = SummaryVersionResponse.model_validate(stored_summary)
    filename = f"meeting-{meeting.id}-v{summary.version}"
    if export_format == "markdown":
        content = export_markdown(meeting.title, summary)
        media_type = "text/markdown; charset=utf-8"
        suffix = "md"
    elif export_format == "text":
        content = export_text(meeting.title, summary)
        media_type = "text/plain; charset=utf-8"
        suffix = "txt"
    else:
        content = export_json(
            {
                "id": meeting.id,
                "title": meeting.title,
                "meeting_at": meeting.meeting_at.isoformat() if meeting.meeting_at else None,
                "timezone": meeting.timezone,
            },
            summary,
        )
        media_type = "application/json; charset=utf-8"
        suffix = "json"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}.{suffix}"'},
    )
