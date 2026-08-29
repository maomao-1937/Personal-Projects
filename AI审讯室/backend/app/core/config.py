from __future__ import annotations

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "sqlite:///./data/ai-interrogation.db"
    cors_origins: str = "http://localhost:3011,http://127.0.0.1:3011"
    llm_enabled: bool = False
    llm_api_key: SecretStr = SecretStr("")
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_case_model: str = "qwen3.6-plus"
    llm_review_model: str = "qwen3.6-plus"
    llm_dialogue_model: str = "qwen-plus-character"
    # Keep below the 120-second pending turn lease so a live request cannot be
    # reclaimed while its provider call is still within the configured timeout.
    llm_timeout_seconds: float = Field(default=90, gt=0, le=90)
    llm_trust_env: bool = False
    access_token_hash: SecretStr = SecretStr("")
    auth_signing_secret: SecretStr = SecretStr("")
    auth_subject: str = "shared-access"
    auth_cookie_name: str = "ai_interrogation_access"
    auth_cookie_secure: bool = False
    auth_session_ttl_seconds: int = Field(default=7 * 24 * 60 * 60, ge=300)
    auth_max_failures: int = Field(default=5, ge=1, le=100)
    auth_failure_window_seconds: int = Field(default=15 * 60, ge=60)
    tos_backup_enabled: bool = False
    tos_access_key: SecretStr = SecretStr("")
    tos_secret_key: SecretStr = SecretStr("")
    tos_endpoint: str = ""
    tos_region: str = ""
    tos_bucket: str = ""
    tos_object_key: str = "db-backup/ai-interrogation.db"
    tos_backup_interval_seconds: int = Field(default=60, ge=15, le=3600)

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(
            self.llm_enabled
            and self.llm_api_key.get_secret_value()
            and self.llm_base_url
            and self.llm_case_model
            and self.llm_review_model
            and self.llm_dialogue_model
        )

    @property
    def auth_configured(self) -> bool:
        return bool(
            self.access_token_hash.get_secret_value()
            and self.auth_signing_secret.get_secret_value()
            and self.auth_subject
            and self.auth_cookie_name
        )

    @property
    def tos_configured(self) -> bool:
        return bool(
            self.tos_backup_enabled
            and self.tos_access_key.get_secret_value()
            and self.tos_secret_key.get_secret_value()
            and self.tos_endpoint
            and self.tos_region
            and self.tos_bucket
            and self.tos_object_key
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
