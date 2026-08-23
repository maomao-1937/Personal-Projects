from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import DomainError
from app.jobs.models import ProcessingJob
from app.meetings.models import Meeting

ACTIVE_STATUSES = ("queued", "running")


def _claimable_conditions(claimed_at: datetime):
    return (
        ProcessingJob.attempts < ProcessingJob.max_attempts,
        or_(
            and_(
                ProcessingJob.status == "queued",
                ProcessingJob.next_run_at <= claimed_at,
            ),
            and_(
                ProcessingJob.status == "running",
                ProcessingJob.lease_expires_at < claimed_at,
            ),
        ),
    )


class JobRepository:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self.session_factory = session_factory

    def create_or_get_summary_job(self, meeting_id: str, *, trace_id: str | None) -> ProcessingJob:
        with self.session_factory() as session:
            try:
                job = self.create_or_get_summary_job_in_session(
                    session,
                    meeting_id,
                    trace_id=trace_id,
                )
                session.commit()
            except IntegrityError:
                session.rollback()
                raced = session.scalar(
                    select(ProcessingJob).where(
                        ProcessingJob.meeting_id == meeting_id,
                        ProcessingJob.job_type == "summary",
                        ProcessingJob.status.in_(ACTIVE_STATUSES),
                    )
                )
                if raced is None:
                    raise
                session.expunge(raced)
                return raced
            session.refresh(job)
            session.expunge(job)
            return job

    @staticmethod
    def create_or_get_summary_job_in_session(
        session: Session,
        meeting_id: str,
        *,
        trace_id: str | None,
    ) -> ProcessingJob:
        existing = session.scalar(
            select(ProcessingJob).where(
                ProcessingJob.meeting_id == meeting_id,
                ProcessingJob.job_type == "summary",
                ProcessingJob.status.in_(ACTIVE_STATUSES),
            )
        )
        if existing is not None:
            return existing
        job = ProcessingJob(
            meeting_id=meeting_id,
            job_type="summary",
            status="queued",
            trace_id=trace_id,
        )
        session.add(job)
        session.flush()
        return job

    def claim_next(
        self,
        *,
        worker_id: str,
        now: datetime | None = None,
        lease_seconds: int = 120,
    ) -> ProcessingJob | None:
        claimed_at = now or datetime.now(UTC)
        with self.session_factory.begin() as session:
            exhausted_candidates = list(
                session.scalars(
                    select(ProcessingJob.meeting_id)
                    .where(
                        ProcessingJob.status == "running",
                        ProcessingJob.lease_expires_at < claimed_at,
                        ProcessingJob.attempts >= ProcessingJob.max_attempts,
                    )
                    .order_by(ProcessingJob.meeting_id)
                )
            )
            if exhausted_candidates:
                # Keep the global Meeting→ProcessingJob lock order used by
                # transcript, deletion, load and terminal-persist paths.
                list(
                    session.scalars(
                        select(Meeting.id)
                        .where(Meeting.id.in_(exhausted_candidates))
                        .order_by(Meeting.id)
                        .with_for_update()
                    )
                )
            exhausted_meeting_ids = list(
                session.scalars(
                    update(ProcessingJob)
                    .where(
                        ProcessingJob.meeting_id.in_(exhausted_candidates),
                        ProcessingJob.status == "running",
                        ProcessingJob.lease_expires_at < claimed_at,
                        ProcessingJob.attempts >= ProcessingJob.max_attempts,
                    )
                    .values(
                        status="failed",
                        error_code="JOB_ATTEMPTS_EXHAUSTED",
                        error_message="任务在达到最大尝试次数后仍未完成",
                        worker_id=None,
                        lease_expires_at=None,
                        updated_at=claimed_at,
                    )
                    .returning(ProcessingJob.meeting_id)
                )
            )
            if exhausted_meeting_ids:
                session.execute(
                    update(Meeting)
                    .where(
                        Meeting.id.in_(exhausted_meeting_ids),
                        Meeting.deleted_at.is_(None),
                    )
                    .values(status="failed", updated_at=claimed_at)
                )
            claimable = _claimable_conditions(claimed_at)
            candidate_id = session.scalar(
                select(ProcessingJob.id)
                .where(*claimable)
                .order_by(ProcessingJob.created_at)
                .with_for_update(skip_locked=True)
                .limit(1)
            )
            if candidate_id is None:
                return None
            claimed = session.scalar(
                update(ProcessingJob)
                .where(ProcessingJob.id == candidate_id, *claimable)
                .values(
                    status="running",
                    attempts=ProcessingJob.attempts + 1,
                    worker_id=worker_id,
                    lease_expires_at=claimed_at + timedelta(seconds=lease_seconds),
                    error_code=None,
                    error_message=None,
                    updated_at=claimed_at,
                )
                .returning(ProcessingJob)
            )
            if claimed is not None:
                session.expunge(claimed)
            return claimed

    def get(self, job_id: str) -> ProcessingJob:
        with self.session_factory() as session:
            job = session.get(ProcessingJob, job_id)
            if job is None:
                raise DomainError("JOB_NOT_FOUND", "处理任务不存在", 404)
            session.expunge(job)
            return job

    def renew_lease(
        self,
        job_id: str,
        *,
        worker_id: str,
        attempt: int,
        now: datetime | None = None,
        lease_seconds: int = 120,
    ) -> bool:
        renewed_at = now or datetime.now(UTC)
        with self.session_factory.begin() as session:
            updated_id = session.scalar(
                update(ProcessingJob)
                .where(
                    ProcessingJob.id == job_id,
                    ProcessingJob.status == "running",
                    ProcessingJob.worker_id == worker_id,
                    ProcessingJob.attempts == attempt,
                )
                .values(
                    lease_expires_at=renewed_at + timedelta(seconds=lease_seconds),
                    updated_at=renewed_at,
                )
                .returning(ProcessingJob.id)
            )
            return updated_id is not None

    def mark_failed(
        self,
        job_id: str,
        *,
        code: str,
        message: str,
        expected_worker_id: str | None = None,
        expected_attempt: int | None = None,
    ) -> bool:
        with self.session_factory.begin() as session:
            conditions = [ProcessingJob.id == job_id]
            if expected_worker_id is not None:
                conditions.extend(
                    [
                        ProcessingJob.status == "running",
                        ProcessingJob.worker_id == expected_worker_id,
                    ]
                )
            if expected_attempt is not None:
                conditions.append(ProcessingJob.attempts == expected_attempt)
            updated_id = session.scalar(
                update(ProcessingJob)
                .where(*conditions)
                .values(
                    status="failed",
                    error_code=code,
                    error_message=message[:500],
                    worker_id=None,
                    lease_expires_at=None,
                    updated_at=datetime.now(UTC),
                )
                .returning(ProcessingJob.id)
            )
            if updated_id is not None:
                return True
            if expected_worker_id is not None or expected_attempt is not None:
                return False
            raise DomainError("JOB_NOT_FOUND", "处理任务不存在", 404)

    def mark_cancelled(
        self,
        job_id: str,
        *,
        expected_worker_id: str | None = None,
        expected_attempt: int | None = None,
    ) -> bool:
        with self.session_factory.begin() as session:
            conditions = [ProcessingJob.id == job_id]
            if expected_worker_id is not None:
                conditions.extend(
                    [
                        ProcessingJob.status == "running",
                        ProcessingJob.worker_id == expected_worker_id,
                    ]
                )
            if expected_attempt is not None:
                conditions.append(ProcessingJob.attempts == expected_attempt)
            updated_id = session.scalar(
                update(ProcessingJob)
                .where(*conditions)
                .values(
                    status="cancelled",
                    worker_id=None,
                    lease_expires_at=None,
                    updated_at=datetime.now(UTC),
                )
                .returning(ProcessingJob.id)
            )
            return updated_id is not None

    def retry(self, job_id: str) -> ProcessingJob:
        with self.session_factory.begin() as session:
            job = self.retry_in_session(session, job_id)
            session.expunge(job)
            return job

    @staticmethod
    def retry_in_session(session: Session, job_id: str) -> ProcessingJob:
        job = session.scalar(
            select(ProcessingJob).where(ProcessingJob.id == job_id).with_for_update()
        )
        if job is None:
            raise DomainError("JOB_NOT_FOUND", "处理任务不存在", 404)
        if job.status != "failed":
            raise DomainError("JOB_NOT_RETRYABLE", "当前任务状态不能重试", 409)
        if job.attempts >= job.max_attempts:
            raise DomainError("JOB_RETRY_EXHAUSTED", "任务已达到最大尝试次数", 409)
        active_job_id = session.scalar(
            select(ProcessingJob.id)
            .where(
                ProcessingJob.meeting_id == job.meeting_id,
                ProcessingJob.job_type == job.job_type,
                ProcessingJob.status.in_(ACTIVE_STATUSES),
                ProcessingJob.id != job.id,
            )
            .limit(1)
        )
        if active_job_id is not None:
            raise DomainError("JOB_ALREADY_ACTIVE", "该会议已有活动处理任务", 409)
        job.status = "queued"
        job.next_run_at = datetime.now(UTC)
        job.error_code = None
        job.error_message = None
        job.worker_id = None
        job.lease_expires_at = None
        try:
            session.flush()
        except IntegrityError as error:
            raise DomainError("JOB_ALREADY_ACTIVE", "该会议已有活动处理任务", 409) from error
        return job
