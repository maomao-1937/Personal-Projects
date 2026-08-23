from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class AppError(Exception):
    code: str
    message: str
    status_code: int
    retryable: bool = False
    field_errors: list[dict[str, Any]] = field(default_factory=list)

    def __str__(self) -> str:
        return self.message


class AccessTokenInvalid(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ACCESS_TOKEN_INVALID",
            message="访问凭证无效，请重新输入邀请码。",
            status_code=401,
        )


class AccessTokenExpired(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ACCESS_TOKEN_EXPIRED",
            message="访问凭证已过期，请重新输入邀请码。",
            status_code=401,
        )


class InviteCodeInvalid(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="INVITE_CODE_INVALID",
            message="邀请码无效。",
            status_code=401,
        )


class InviteQuotaExhausted(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="INVITE_QUOTA_EXHAUSTED",
            message="该邀请码的可用次数已用完。",
            status_code=403,
        )


class TranscriptInvalid(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code=code, message=message, status_code=422)


class ModelOutputInvalid(AppError):
    def __init__(self, message: str = "模型返回的报告结构无效。") -> None:
        super().__init__(
            code="MODEL_OUTPUT_INVALID",
            message=message,
            status_code=502,
            retryable=True,
        )


class LLMNotConfigured(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="LLM_NOT_CONFIGURED",
            message="模型服务尚未配置。",
            status_code=503,
        )


class ModelUnavailable(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="MODEL_UNAVAILABLE",
            message="模型服务暂时不可用，请稍后重试。",
            status_code=503,
            retryable=True,
        )


class IdempotencyConflict(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="IDEMPOTENCY_CONFLICT",
            message="该请求标识已使用，请为新的分析生成新的请求标识。",
            status_code=409,
        )


class CSRFInvalid(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="CSRF_INVALID",
            message="请求校验失败，请刷新页面后重试。",
            status_code=403,
        )


class RequestTooLarge(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="REQUEST_TOO_LARGE",
            message="请求内容超过允许的大小。",
            status_code=413,
        )


class BackupUnavailable(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="BACKUP_UNAVAILABLE",
            message="数据保护暂时不可用，请稍后重试。",
            status_code=503,
            retryable=True,
        )


class BackupCredentialsUnavailable(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="BACKUP_CREDENTIALS_UNAVAILABLE",
            message="数据保护凭证暂时不可用，请稍后重试。",
            status_code=503,
            retryable=True,
        )


class AnalysisNotFound(AppError):
    def __init__(self) -> None:
        super().__init__(
            code="ANALYSIS_NOT_FOUND",
            message="未找到可反馈的分析结果。",
            status_code=404,
        )
