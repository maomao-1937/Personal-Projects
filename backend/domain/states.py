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

