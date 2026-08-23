from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import DomainError
from app.jobs.models import ProcessingJob
from app.jobs.repository import JobRepository
from app.meetings.models import AuditEvent, Meeting, TranscriptSegment
from app.summaries.models import SummaryVersion
from app.summaries.pipeline import validate_summary
from app.summaries.schemas import SummaryPayload


class SummaryService:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self.session_factory = session_factory
        self.jobs = JobRepository(session_factory)

    def create_job(self, meeting_id: str, *, trace_id: str | None) -> ProcessingJob:
        with self.session_factory() as session:
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
            segment_count = session.scalar(
                select(func.count(TranscriptSegment.id)).where(
                    TranscriptSegment.meeting_id == meeting_id
                )
            )
            if not segment_count:
                raise DomainError("TRANSCRIPT_REQUIRED", "请先添加有效转录", 409)
            job = self.jobs.create_or_get_summary_job_in_session(
                session,
                meeting_id,
                trace_id=trace_id,
            )
            if job.status == "queued":
                meeting.status = "queued"
            session.commit()
            session.refresh(job)
            session.expunge(job)
            return job

    def get_job(self, job_id: str) -> ProcessingJob:
        job = self.jobs.get(job_id)
        with self.session_factory() as session:
            meeting = session.get(Meeting, job.meeting_id)
            if meeting is None or meeting.deleted_at is not None:
                raise DomainError("JOB_NOT_FOUND", "处理任务不存在", 404)
        return job

    def retry_job(self, job_id: str) -> ProcessingJob:
        with self.session_factory() as session:
            meeting_id = session.scalar(
                select(ProcessingJob.meeting_id).where(ProcessingJob.id == job_id)
            )
            if meeting_id is None:
                raise DomainError("JOB_NOT_FOUND", "处理任务不存在", 404)
            meeting = session.scalar(
                select(Meeting)
                .where(
                    Meeting.id == meeting_id,
                    Meeting.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if meeting is None:
                raise DomainError("JOB_NOT_FOUND", "处理任务不存在", 404)
            retried = self.jobs.retry_in_session(session, job_id)
            meeting.status = "queued"
            session.commit()
            session.refresh(retried)
            session.expunge(retried)
            return retried

    def list_versions(self, meeting_id: str) -> list[SummaryVersion]:
        with self.session_factory() as session:
            self._require_meeting(session, meeting_id)
            summaries = list(
                session.scalars(
                    select(SummaryVersion)
                    .where(SummaryVersion.meeting_id == meeting_id)
                    .order_by(SummaryVersion.version.desc())
                )
            )
            for summary in summaries:
                session.expunge(summary)
            return summaries

    def get_version(self, summary_id: str) -> SummaryVersion:
        with self.session_factory() as session:
            summary = session.get(SummaryVersion, summary_id)
            if summary is None:
                raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
            self._require_meeting(session, summary.meeting_id)
            session.expunge(summary)
            return summary

    def create_revision(
        self,
        summary_id: str,
        *,
        expected_version: int,
        content: SummaryPayload,
        session_fingerprint: str,
        trace_id: str,
    ) -> SummaryVersion:
        with self.session_factory() as session:
            parent = session.get(SummaryVersion, summary_id)
            if parent is None:
                raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
            self._require_meeting(session, parent.meeting_id, for_update=True)
            latest_version = session.scalar(
                select(func.max(SummaryVersion.version)).where(
                    SummaryVersion.meeting_id == parent.meeting_id
                )
            )
            if latest_version != expected_version or parent.version != latest_version:
                raise DomainError("VERSION_CONFLICT", "摘要已被更新，请刷新后重试", 409)
            known_ids, speakers = self._known_sources(session, parent.meeting_id)
            validate_summary(content, known_ids, speakers)
            revision = SummaryVersion(
                meeting_id=parent.meeting_id,
                version=latest_version + 1,
                schema_version=content.summary_version,
                content=content.model_dump(mode="json"),
                quality_flags=content.quality_flags,
                status="ready_for_review",
                parent_version_id=parent.id,
                created_source="human",
            )
            session.add(revision)
            meeting = session.get(Meeting, parent.meeting_id)
            if meeting is not None:
                meeting.status = "ready_for_review"
            try:
                session.flush()
                session.add(
                    AuditEvent(
                        session_fingerprint=session_fingerprint,
                        action="summary_revision",
                        resource_type="summary_version",
                        resource_id=revision.id,
                        result="succeeded",
                        trace_id=trace_id,
                        details={"version": revision.version},
                    )
                )
                session.commit()
            except IntegrityError as error:
                session.rollback()
                raise DomainError("VERSION_CONFLICT", "摘要已被更新，请刷新后重试", 409) from error
            session.refresh(revision)
            session.expunge(revision)
            return revision

    def approve(
        self,
        summary_id: str,
        *,
        session_fingerprint: str,
        trace_id: str,
    ) -> SummaryVersion:
        with self.session_factory.begin() as session:
            summary = session.get(SummaryVersion, summary_id)
            if summary is None:
                raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
            meeting = self._require_meeting(session, summary.meeting_id, for_update=True)
            latest_version = session.scalar(
                select(func.max(SummaryVersion.version)).where(
                    SummaryVersion.meeting_id == summary.meeting_id
                )
            )
            if summary.version != latest_version:
                raise DomainError("VERSION_CONFLICT", "只能确认最新摘要版本", 409)
            content = SummaryPayload.model_validate(summary.content)
            known_ids, speakers = self._known_sources(session, summary.meeting_id)
            validate_summary(content, known_ids, speakers)
            summary.status = "approved"
            meeting.status = "approved"
            session.add(
                AuditEvent(
                    session_fingerprint=session_fingerprint,
                    action="summary_approve",
                    resource_type="summary_version",
                    resource_id=summary.id,
                    result="succeeded",
                    trace_id=trace_id,
                    details={"version": summary.version},
                )
            )
            session.flush()
            session.expunge(summary)
            return summary

    def export_bundle(
        self, summary_id: str
    ) -> tuple[Meeting, SummaryVersion, list[TranscriptSegment]]:
        with self.session_factory() as session:
            summary = session.get(SummaryVersion, summary_id)
            if summary is None:
                raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
            meeting = self._require_meeting(session, summary.meeting_id)
            segments = list(
                session.scalars(
                    select(TranscriptSegment)
                    .where(TranscriptSegment.meeting_id == meeting.id)
                    .order_by(TranscriptSegment.sequence)
                )
            )
            session.expunge(meeting)
            session.expunge(summary)
            for segment in segments:
                session.expunge(segment)
            return meeting, summary, segments

    @staticmethod
    def _require_meeting(
        session: Session,
        meeting_id: str,
        *,
        for_update: bool = False,
    ) -> Meeting:
        statement = select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.deleted_at.is_(None),
        )
        if for_update:
            statement = statement.with_for_update()
        meeting = session.scalar(statement)
        if meeting is None:
            raise DomainError("MEETING_NOT_FOUND", "会议不存在", 404)
        return meeting

    @staticmethod
    def _known_sources(session: Session, meeting_id: str) -> tuple[set[str], set[str]]:
        segments = list(
            session.scalars(
                select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)
            )
        )
        return (
            {item.id for item in segments},
            {item.speaker for item in segments if item.speaker},
        )
