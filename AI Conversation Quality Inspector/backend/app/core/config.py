from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from process environment or ``.env``."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "sqlite:///./data/app.db"
    storage_provider: Literal["local", "s3"] = "local"
    s3_auth_mode: Literal["static", "vefaas_request"] = "static"
    sqlite_backup_interval_seconds: int = Field(default=300, ge=30)
    sqlite_backup_max_age_seconds: int = Field(default=600, ge=60)
    sqlite_allow_bootstrap: bool = False
    s3_endpoint: str | None = None
    s3_region: str | None = None
    s3_bucket: str | None = None
    s3_access_key: SecretStr | None = None
    s3_secret_key: SecretStr | None = None
    s3_object_prefix: str = "conversation-qa"

    session_secret: SecretStr = SecretStr("dev-session-secret-only")
    invite_code_pepper: SecretStr = SecretStr("dev-invite-pepper-only")
    invite_codes: str = ""
    invite_usage_limit: int = Field(default=50, gt=0)
    access_ttl_seconds: int = Field(default=43_200, gt=0)
    reservation_ttl_seconds: int = Field(default=180, ge=120)

    min_transcript_chars: int = Field(default=20, ge=1)
    max_transcript_chars: int = Field(default=12_000, ge=100)
    max_turns: int = Field(default=200, ge=2)
    max_request_body_bytes: int = Field(default=131_072, ge=1024)
    metadata_retention_days: int = Field(default=90, ge=1)

    llm_api_key: SecretStr | None = None
    llm_base_url: str | None = None
    llm_model: str = ""
    llm_timeout_seconds: float = Field(default=60.0, gt=0)
    llm_max_attempts: int = Field(default=2, ge=1, le=2)
    llm_temperature: float = Field(default=0.1, ge=0, le=1)
    llm_reasoning_effort: Literal["minimal", "low", "medium", "high"] | None = None
    llm_max_tokens: int = Field(default=3000, gt=0)

    allowed_origins: str = "http://localhost:3010"
    rubric_version: str = "qa-rubric-v1"
    prompt_version: str = "qa-analysis-v1"

    @field_validator("llm_reasoning_effort", mode="before")
    @classmethod
    def empty_reasoning_effort_as_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "prod"

    @property
    def configured_invite_codes(self) -> tuple[str, ...]:
        return tuple(code.strip() for code in self.invite_codes.split(",") if code.strip())

    @property
    def allowed_origin_list(self) -> tuple[str, ...]:
        return tuple(origin.strip() for origin in self.allowed_origins.split(",") if origin.strip())

    @property
    def llm_is_configured(self) -> bool:
        return bool(
            self.llm_api_key
            and self.llm_api_key.get_secret_value().strip()
            and self.llm_model.strip()
        )

    @model_validator(mode="after")
    def validate_runtime_constraints(self) -> "Settings":
        if self.max_transcript_chars <= self.min_transcript_chars:
            raise ValueError("MAX_TRANSCRIPT_CHARS must exceed MIN_TRANSCRIPT_CHARS")
        if self.sqlite_backup_max_age_seconds < self.sqlite_backup_interval_seconds * 2:
            raise ValueError(
                "SQLITE_BACKUP_MAX_AGE_SECONDS must be at least twice the backup interval"
            )
        if self.storage_provider == "s3":
            common_s3_values = (
                self.s3_endpoint and self.s3_endpoint.strip(),
                self.s3_region and self.s3_region.strip(),
                self.s3_bucket and self.s3_bucket.strip(),
                self.s3_object_prefix.strip(),
            )
            static_credentials = (
                self.s3_access_key and self.s3_access_key.get_secret_value().strip(),
                self.s3_secret_key and self.s3_secret_key.get_secret_value().strip(),
            )
            if not all(common_s3_values) or (
                self.s3_auth_mode == "static" and not all(static_credentials)
            ):
                raise ValueError("S3 backup configuration is incomplete")
        if self.environment == "prod":
            if len(self.session_secret.get_secret_value()) < 32:
                raise ValueError("SESSION_SECRET must contain at least 32 characters")
            if len(self.invite_code_pepper.get_secret_value()) < 32:
                raise ValueError("INVITE_CODE_PEPPER must contain at least 32 characters")
            if self.database_url.startswith("sqlite") and self.storage_provider != "s3":
                raise ValueError("STORAGE_PROVIDER=s3 is required for production SQLite")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
