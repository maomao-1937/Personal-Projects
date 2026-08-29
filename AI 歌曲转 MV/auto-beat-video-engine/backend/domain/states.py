from enum import StrEnum


class JobStatus(StrEnum):
    ACCEPTED = "accepted"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED_RETRYABLE = "failed_retryable"
    FAILED_TERMINAL = "failed_terminal"
    TIMED_OUT = "timed_out"
    CANCELLED = "cancelled"
    UNKNOWN_PROVIDER_STATE = "unknown_provider_state"


TERMINAL_JOB_STATUSES = {
    JobStatus.SUCCEEDED,
    JobStatus.FAILED_TERMINAL,
    JobStatus.TIMED_OUT,
    JobStatus.CANCELLED,
}

ALLOWED_JOB_TRANSITIONS: dict[JobStatus, set[JobStatus]] = {
    JobStatus.ACCEPTED: {JobStatus.QUEUED, JobStatus.CANCELLED},
    JobStatus.QUEUED: {JobStatus.RUNNING, JobStatus.CANCELLED},
    JobStatus.RUNNING: {
        JobStatus.SUCCEEDED,
        JobStatus.FAILED_RETRYABLE,
        JobStatus.FAILED_TERMINAL,
        JobStatus.TIMED_OUT,
        JobStatus.CANCELLED,
        JobStatus.UNKNOWN_PROVIDER_STATE,
    },
    JobStatus.FAILED_RETRYABLE: {JobStatus.QUEUED, JobStatus.CANCELLED},
    JobStatus.UNKNOWN_PROVIDER_STATE: {
        JobStatus.RUNNING,
        JobStatus.SUCCEEDED,
        JobStatus.FAILED_RETRYABLE,
        JobStatus.FAILED_TERMINAL,
        JobStatus.TIMED_OUT,
    },
    JobStatus.SUCCEEDED: set(),
    JobStatus.FAILED_TERMINAL: set(),
    JobStatus.TIMED_OUT: set(),
    JobStatus.CANCELLED: set(),
}


def can_transition(current: str, target: str) -> bool:
    try:
        current_status = JobStatus(current)
        target_status = JobStatus(target)
    except ValueError:
        return False
    return target_status in ALLOWED_JOB_TRANSITIONS[current_status]
