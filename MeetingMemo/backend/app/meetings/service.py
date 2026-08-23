import hashlib
from datetime import UTC, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.errors import DomainError
from app.jobs.models import ProcessingJob
from app.meetings.models import Feedback, Meeting, TranscriptSegment
from app.meetings.parsers import ParsedSegment, parse_txt
from app.meetings.schemas import FeedbackCreate, MeetingCreate
from app.summaries.models import SummaryVersion


class MeetingService:
    def __init__(
        self,
        settings: Settings,
        session_factory: sessionmaker[Session],
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory

    def create(self, payload: MeetingCreate) -> Meeting:
        meeting = Meeting(
            title=payload.title,
            meeting_at=payload.meeting_at,
            timezone=payload.timezone,
            language=payload.language,
            source="manual",
            status="draft",
        )
        with self.session_factory.begin() as session:
            session.add(meeting)
            session.flush()
            session.expunge(meeting)
        return meeting

    def list_meetings(self) -> list[Meeting]:
        with self.session_factory() as session:
            meetings = list(
                session.scalars(
                    select(Meeting)
                    .where(Meeting.deleted_at.is_(None))
                    .order_by(Meeting.created_at.desc())
                )
            )
            for meeting in meetings:
                session.expunge(meeting)
            return meetings

    def get(self, meeting_id: str) -> tuple[Meeting, list[TranscriptSegment]]:
        with self.session_factory() as session:
            meeting = session.scalar(
                select(Meeting).where(
                    Meeting.id == meeting_id,
                    Meeting.deleted_at.is_(None),
                )
            )
            if meeting is None:
                raise DomainError("MEETING_NOT_FOUND", "会议不存在", 404)
            segments = list(
                session.scalars(
                    select(TranscriptSegment)
                    .where(TranscriptSegment.meeting_id == meeting_id)
                    .order_by(TranscriptSegment.sequence)
                )
            )
            session.expunge(meeting)
            for segment in segments:
                session.expunge(segment)
            return meeting, segments

    def replace_text_transcript(self, meeting_id: str, text: str) -> int:
        return self.replace_transcript(meeting_id, parse_txt(text))

    def replace_transcript(self, meeting_id: str, parsed_segments: list[ParsedSegment]) -> int:
        with self.session_factory.begin() as session:
            meeting = session.scalar(
                select(Meeting)
                .where(
                    Meeting.id == meeting_id,
                    Meeting.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if meeting is None:
                raise DomainError("MEETING_NOT_FOUND", "会议不存在", 404)
            has_summary = session.scalar(
                select(SummaryVersion.id).where(SummaryVersion.meeting_id == meeting_id).limit(1)
            )
            has_active_job = session.scalar(
                select(ProcessingJob.id)
                .where(
                    ProcessingJob.meeting_id == meeting_id,
                    ProcessingJob.status.in_(["queued", "running"]),
                )
                .limit(1)
            )
            if has_summary is not None or has_active_job is not None:
                raise DomainError("TRANSCRIPT_LOCKED", "摘要任务创建后不能替换原始转录", 409)
            session.execute(
                delete(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)
            )
            for item in parsed_segments:
                digest = hashlib.sha256(
                    f"{meeting_id}:{item.sequence}:{item.text}".encode()
                ).hexdigest()[:24]
                session.add(
                    TranscriptSegment(
                        id=f"seg_{digest}",
                        meeting_id=meeting_id,
                        sequence=item.sequence,
                        start_ms=item.start_ms,
                        end_ms=item.end_ms,
                        speaker=item.speaker,
                        text=item.text,
                    )
                )
            meeting.updated_at = datetime.now(UTC)
        return len(parsed_segments)

    def delete(self, meeting_id: str) -> None:
        deleted_at = datetime.now(UTC)
        with self.session_factory.begin() as session:
            meeting = session.scalar(
                select(Meeting)
                .where(
                    Meeting.id == meeting_id,
                    Meeting.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if meeting is None:
                raise DomainError("MEETING_NOT_FOUND", "会议不存在", 404)
            meeting.deleted_at = deleted_at
            meeting.status = "archived"
            session.execute(
                update(ProcessingJob)
                .where(
                    ProcessingJob.meeting_id == meeting_id,
                    ProcessingJob.status.in_(["queued", "running"]),
                )
                .values(status="cancelled", updated_at=deleted_at)
            )

    def create_feedback(self, payload: FeedbackCreate) -> Feedback:
        with self.session_factory.begin() as session:
            meeting = None
            if payload.meeting_id is not None:
                meeting = session.scalar(
                    select(Meeting).where(
                        Meeting.id == payload.meeting_id,
                        Meeting.deleted_at.is_(None),
                    )
                )
                if meeting is None:
                    raise DomainError("MEETING_NOT_FOUND", "会议不存在", 404)

            summary = None
            if payload.summary_version_id is not None:
                summary = session.get(SummaryVersion, payload.summary_version_id)
                if summary is None:
                    raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
                summary_meeting = session.scalar(
                    select(Meeting).where(
                        Meeting.id == summary.meeting_id,
                        Meeting.deleted_at.is_(None),
                    )
                )
                if summary_meeting is None:
                    raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
                if meeting is not None and summary.meeting_id != meeting.id:
                    raise DomainError("FEEDBACK_REFERENCE_MISMATCH", "反馈引用不一致", 409)

            feedback = Feedback(
                meeting_id=payload.meeting_id,
                summary_version_id=payload.summary_version_id,
                rating=payload.rating,
                error_types=list(payload.error_types),
                comment=payload.comment,
            )
            session.add(feedback)
            session.flush()
            session.expunge(feedback)
            return feedback
