from threading import Event, Thread
from uuid import uuid4

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.errors import DomainError
from app.core.logging import log_background_error
from app.jobs.models import ProcessingJob
from app.jobs.repository import JobRepository
from app.meetings.models import Meeting, TranscriptSegment
from app.summaries.models import SummaryVersion
from app.summaries.pipeline import SummaryPipeline, validate_summary
from app.summaries.providers import (
    MockSummaryProvider,
    OpenAICompatibleSummaryProvider,
    SummaryProvider,
)
from app.summaries.schemas import PromptSegment, SummaryPayload


def build_summary_provider(settings: Settings) -> SummaryProvider:
    if settings.llm_provider == "mock":
        return MockSummaryProvider()
    return OpenAICompatibleSummaryProvider(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
    )


class SummaryJobRunner:
    def __init__(
        self,
        settings: Settings,
        session_factory: sessionmaker[Session],
        *,
        provider: SummaryProvider | None = None,
        poll_interval: float = 0.5,
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.repository = JobRepository(session_factory)
        self.pipeline = SummaryPipeline(provider or build_summary_provider(settings))
        self.poll_interval = poll_interval
        self.worker_id = f"worker-{uuid4()}"
        self._stop_event = Event()
        self._thread: Thread | None = None

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = Thread(target=self._loop, name=self.worker_id, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)

    @property
    def is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                processed = self.run_once()
            except Exception as error:
                log_background_error(
                    component="summary_job_runner",
                    error_type=type(error).__name__,
                )
                processed = False
            if not processed:
                self._stop_event.wait(self.poll_interval)

    def run_once(self) -> bool:
        job = self.repository.claim_next(
            worker_id=self.worker_id,
            lease_seconds=self.settings.job_lease_seconds,
        )
        if job is None:
            return False
        heartbeat_stop = Event()
        heartbeat = Thread(
            target=self._heartbeat_loop,
            args=(job, heartbeat_stop),
            name=f"heartbeat-{job.id}",
            daemon=True,
        )
        heartbeat.start()
        try:
            segments = self._load_segments(job)
            if segments is None:
                self.repository.mark_cancelled(
                    job.id,
                    expected_worker_id=job.worker_id,
                    expected_attempt=job.attempts,
                )
                return True
            summary = self.pipeline.run(segments)
            self._persist_success(job, summary.model_dump(mode="json"), summary.quality_flags)
        except DomainError as error:
            self._persist_failure(job, error.code, error.message)
        except Exception:
            self._persist_failure(
                job,
                "SUMMARY_JOB_FAILED",
                "摘要生成失败，请重试",
            )
        finally:
            heartbeat_stop.set()
            heartbeat.join(timeout=5)
        return True

    def _heartbeat_loop(self, job: ProcessingJob, stop_event: Event) -> None:
        if job.worker_id is None:
            return
        while not stop_event.wait(self.settings.job_heartbeat_seconds):
            try:
                renewed = self.repository.renew_lease(
                    job.id,
                    worker_id=job.worker_id,
                    attempt=job.attempts,
                    lease_seconds=self.settings.job_lease_seconds,
                )
            except Exception as error:
                log_background_error(
                    component="summary_job_heartbeat",
                    error_type=type(error).__name__,
                )
                continue
            if not renewed:
                return

    def _load_segments(self, job: ProcessingJob) -> list[PromptSegment] | None:
        with self.session_factory.begin() as session:
            # All meeting/job transactions lock in this order to avoid a
            # Job→Meeting / Meeting→Job deadlock on PostgreSQL.
            meeting = session.scalar(
                select(Meeting).where(Meeting.id == job.meeting_id).with_for_update()
            )
            if meeting is None or meeting.deleted_at is not None:
                return None
            owned_job_id = session.scalar(
                select(ProcessingJob.id)
                .where(
                    ProcessingJob.id == job.id,
                    ProcessingJob.status == "running",
                    ProcessingJob.worker_id == job.worker_id,
                    ProcessingJob.attempts == job.attempts,
                )
                .with_for_update()
            )
            if owned_job_id is None:
                return None
            meeting.status = "summarizing"
            stored_segments = list(
                session.scalars(
                    select(TranscriptSegment)
                    .where(TranscriptSegment.meeting_id == meeting.id)
                    .order_by(TranscriptSegment.sequence)
                )
            )
            return [
                PromptSegment(
                    id=item.id,
                    sequence=item.sequence,
                    speaker=item.speaker,
                    start_ms=item.start_ms,
                    end_ms=item.end_ms,
                    text=item.text,
                )
                for item in stored_segments
            ]

    def _persist_success(
        self,
        job: ProcessingJob,
        content: dict[str, object],
        quality_flags: list[str],
    ) -> None:
        with self.session_factory.begin() as session:
            meeting = session.scalar(
                select(Meeting).where(Meeting.id == job.meeting_id).with_for_update()
            )
            if meeting is None:
                return
            terminal_status = "cancelled" if meeting.deleted_at is not None else "succeeded"
            updated_job_id = session.scalar(
                update(ProcessingJob)
                .where(
                    ProcessingJob.id == job.id,
                    ProcessingJob.status == "running",
                    ProcessingJob.worker_id == job.worker_id,
                    ProcessingJob.attempts == job.attempts,
                )
                .values(
                    status=terminal_status,
                    worker_id=None,
                    lease_expires_at=None,
                    error_code=None,
                    error_message=None,
                )
                .returning(ProcessingJob.id)
            )
            if updated_job_id is None or meeting.deleted_at is not None:
                return
            stored_segments = list(
                session.scalars(
                    select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting.id)
                )
            )
            validated_content = SummaryPayload.model_validate(content)
            validate_summary(
                validated_content,
                {item.id for item in stored_segments},
                {item.speaker for item in stored_segments if item.speaker},
            )
            latest_version = session.scalar(
                select(func.max(SummaryVersion.version)).where(
                    SummaryVersion.meeting_id == meeting.id
                )
            )
            session.add(
                SummaryVersion(
                    meeting_id=meeting.id,
                    version=(latest_version or 0) + 1,
                    schema_version=validated_content.summary_version,
                    content=validated_content.model_dump(mode="json"),
                    quality_flags=quality_flags,
                    status="ready_for_review",
                    created_source="model",
                )
            )
            meeting.status = "ready_for_review"

    def _persist_failure(self, job: ProcessingJob, code: str, message: str) -> None:
        with self.session_factory.begin() as session:
            meeting = session.scalar(
                select(Meeting).where(Meeting.id == job.meeting_id).with_for_update()
            )
            if meeting is None:
                return
            terminal_status = "cancelled" if meeting.deleted_at is not None else "failed"
            updated_job_id = session.scalar(
                update(ProcessingJob)
                .where(
                    ProcessingJob.id == job.id,
                    ProcessingJob.status == "running",
                    ProcessingJob.worker_id == job.worker_id,
                    ProcessingJob.attempts == job.attempts,
                )
                .values(
                    status=terminal_status,
                    error_code=None if terminal_status == "cancelled" else code,
                    error_message=None if terminal_status == "cancelled" else message[:500],
                    worker_id=None,
                    lease_expires_at=None,
                )
                .returning(ProcessingJob.id)
            )
            if updated_job_id is not None and meeting.deleted_at is None:
                meeting.status = "failed"
