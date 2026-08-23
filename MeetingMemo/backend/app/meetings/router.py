from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Request, UploadFile

from app.access.dependencies import require_access_session
from app.meetings.parsers import parse_transcript_file
from app.meetings.schemas import (
    FeedbackCreate,
    FeedbackResponse,
    MeetingCreate,
    MeetingDetailResponse,
    MeetingListResponse,
    MeetingResponse,
    TranscriptSegmentResponse,
    TranscriptTextRequest,
    TranscriptUpdateResponse,
)
from app.meetings.service import MeetingService
from app.meetings.storage import LocalTranscriptStorage

router = APIRouter(
    prefix="/api/v1/meetings",
    tags=["meetings"],
    dependencies=[Depends(require_access_session)],
)

feedback_router = APIRouter(
    prefix="/api/v1",
    tags=["feedback"],
    dependencies=[Depends(require_access_session)],
)


def get_meeting_service(request: Request) -> MeetingService:
    return MeetingService(request.app.state.settings, request.app.state.session_factory)


@router.post("", response_model=MeetingResponse, status_code=201)
def create_meeting(
    payload: MeetingCreate,
    service: Annotated[MeetingService, Depends(get_meeting_service)],
) -> MeetingResponse:
    return MeetingResponse.model_validate(service.create(payload))


@router.get("", response_model=MeetingListResponse)
def list_meetings(
    service: Annotated[MeetingService, Depends(get_meeting_service)],
) -> MeetingListResponse:
    return MeetingListResponse(
        items=[MeetingResponse.model_validate(item) for item in service.list_meetings()]
    )


@router.get("/{meeting_id}", response_model=MeetingDetailResponse)
def read_meeting(
    meeting_id: str,
    service: Annotated[MeetingService, Depends(get_meeting_service)],
) -> MeetingDetailResponse:
    meeting, segments = service.get(meeting_id)
    return MeetingDetailResponse(
        **MeetingResponse.model_validate(meeting).model_dump(),
        segments=[TranscriptSegmentResponse.model_validate(item) for item in segments],
    )


@router.post("/{meeting_id}/transcript", response_model=TranscriptUpdateResponse)
def replace_text_transcript(
    meeting_id: str,
    payload: TranscriptTextRequest,
    request: Request,
    service: Annotated[MeetingService, Depends(get_meeting_service)],
) -> TranscriptUpdateResponse:
    count = service.replace_text_transcript(meeting_id, payload.text)
    LocalTranscriptStorage(request.app.state.settings.upload_dir).delete_meeting_assets(meeting_id)
    return TranscriptUpdateResponse(meeting_id=meeting_id, segment_count=count)


@router.post("/{meeting_id}/transcript-file", response_model=TranscriptUpdateResponse)
async def replace_transcript_file(
    meeting_id: str,
    file: UploadFile,
    request: Request,
    service: Annotated[MeetingService, Depends(get_meeting_service)],
) -> TranscriptUpdateResponse:
    settings = request.app.state.settings
    content = await file.read(settings.max_upload_bytes + 1)
    segments = parse_transcript_file(
        file.filename or "",
        file.content_type,
        content,
        max_bytes=settings.max_upload_bytes,
    )
    suffix = Path(file.filename or "").suffix.lower()
    storage = LocalTranscriptStorage(settings.upload_dir)
    staged = storage.stage(meeting_id, suffix, content)
    try:
        count = service.replace_transcript(meeting_id, segments)
        staged.commit()
    except Exception:
        staged.discard()
        raise
    return TranscriptUpdateResponse(meeting_id=meeting_id, segment_count=count)


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(
    meeting_id: str,
    request: Request,
    service: Annotated[MeetingService, Depends(get_meeting_service)],
) -> None:
    service.delete(meeting_id)
    LocalTranscriptStorage(request.app.state.settings.upload_dir).delete_meeting_assets(meeting_id)


@feedback_router.post("/feedback", response_model=FeedbackResponse, status_code=201)
def create_feedback(
    payload: FeedbackCreate,
    service: Annotated[MeetingService, Depends(get_meeting_service)],
) -> FeedbackResponse:
    return FeedbackResponse.model_validate(service.create_feedback(payload))
