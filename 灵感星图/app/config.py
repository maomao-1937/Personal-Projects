from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "灵感星图"
    database_url: str = "sqlite:///./incubator.db"
    app_api_token: str | None = None
    tencent_hy3_api_key: str | None = None
    anthropic_api_key: str | None = None
    model_id: str = "claude-sonnet-4-6"
    retrieval_limit: int = 12

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
