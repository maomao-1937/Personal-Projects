from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import SplitResult, urlsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_url(value: str | None) -> SplitResult | None:
    if not value:
        return None
    try:
        return urlsplit(value.strip())
    except ValueError:
        return None


def _is_https_url(value: str | None) -> bool:
    parsed = _parse_url(value)
    if parsed is None:
        return False
    return (
        parsed.scheme == "https"
        and parsed.hostname is not None
        and parsed.username is None
        and parsed.password is None
    )


def _is_https_origin(value: str) -> bool:
    parsed = _parse_url(value)
    if parsed is None or not _is_https_url(value):
        return False
    return (
        parsed.path in {"", "/"}
        and not parsed.query
        and not parsed.fragment
        and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
        and not (parsed.hostname or "").endswith(".localhost")
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    app_env: Literal["development", "test", "production"] = Field(
        default="development",
        validation_alias="MEETINGMEMO_APP_ENV",
    )
    app_name: str = "meetingmemo-api"
    database_url: str = "sqlite:///./data/meetingmemo.db"
    frontend_origin: str = "http://localhost:3000"
    secret_key: str = "development-secret-key-change-me-now"
    session_days: int = Field(default=30, ge=1, le=365)
    allow_originless_state_changes: bool | None = None
    invite_rate_limit_attempts: int = Field(default=20, ge=1, le=1000)
    invite_rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    job_lease_seconds: int = Field(default=900, ge=60, le=3600)
    job_heartbeat_seconds: int = Field(default=30, ge=5, le=300)
    delivery_pending_timeout_seconds: int = Field(default=120, ge=30, le=3600)
    upload_dir: Path = Path("./data/uploads")
    static_site_dir: Path | None = None
    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)
    max_request_bytes: int = Field(default=6 * 1024 * 1024, ge=2048)
    llm_provider: Literal["mock", "openai-compatible"] = "mock"
    llm_api_key: str | None = None
    llm_base_url: str = "https://example.invalid/v1"
    llm_model: str = "mock-summary-v1"
    slack_webhook_url: str | None = None
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    email_default_to: str | None = None
    smtp_use_tls: bool = True

    @property
    def secure_cookies(self) -> bool:
        return self.app_env == "production"

    @property
    def originless_state_changes_allowed(self) -> bool:
        if self.allow_originless_state_changes is not None:
            return self.allow_originless_state_changes
        return self.app_env != "production"

    def missing_production_secrets(self) -> list[str]:
        missing: list[str] = []
        if self.app_env != "production":
            missing.append("MEETINGMEMO_APP_ENV")
        if self.app_env == "production" and self.originless_state_changes_allowed:
            missing.append("ALLOW_ORIGINLESS_STATE_CHANGES")
        if (
            self.secret_key == "development-secret-key-change-me-now"
            or len(self.secret_key.strip()) < 32
        ):
            missing.append("SECRET_KEY")
        if not self.database_url.strip().startswith(("postgresql://", "postgresql+psycopg://")):
            missing.append("DATABASE_URL")
        if not _is_https_origin(self.frontend_origin):
            missing.append("FRONTEND_ORIGIN")
        if self.llm_provider != "openai-compatible":
            missing.append("LLM_PROVIDER")
        if not _is_https_url(self.llm_base_url) or "example.invalid" in self.llm_base_url:
            missing.append("LLM_BASE_URL")
        normalized_model = self.llm_model.strip()
        if not normalized_model or normalized_model.startswith("mock-"):
            missing.append("LLM_MODEL")
        if not self.llm_api_key or not self.llm_api_key.strip():
            missing.append("LLM_API_KEY")
        if self.slack_webhook_url:
            parsed_slack_url = _parse_url(self.slack_webhook_url)
            if (
                parsed_slack_url is None
                or not _is_https_url(self.slack_webhook_url)
                or parsed_slack_url.hostname not in {"hooks.slack.com", "hooks.slack-gov.com"}
                or not parsed_slack_url.path.startswith("/services/")
            ):
                missing.append("SLACK_WEBHOOK_URL")
        if self.smtp_host and not self.smtp_use_tls:
            missing.append("SMTP_USE_TLS")
        return missing


@lru_cache
def get_settings() -> Settings:
    return Settings()
