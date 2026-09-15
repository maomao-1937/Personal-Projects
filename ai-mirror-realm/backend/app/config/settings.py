import os
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "AI 镜界"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:////tmp/mirror-realm/mirror_realm.db"

    SECRET_KEY: str = "mirror-realm-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    AUTH_COOKIE_NAME: str = "mirror_session"
    AUTH_COOKIE_SECURE: bool = False
    INVITE_TOKEN_PEPPER: str = ""

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    UPLOAD_DIR: Path = Path("/tmp/mirror-realm/uploads")
    GENERATED_DIR: Path = Path("/tmp/mirror-realm/generated")

    AI_API_KEY: str = ""
    AI_API_BASE_URL: str = "https://ark.cn-beijing.volces.com"
    AI_MODEL: str = "doubao-seedream-4.5"
    AI_IMAGE_SIZE: str = "2K"

    MAX_FILE_SIZE: int = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS: set[str] = {"jpg", "jpeg", "png", "webp"}

    FREE_CREDITS: int = 3

    @model_validator(mode="after")
    def require_secure_cookie_outside_debug(self) -> "Settings":
        if not self.DEBUG and not self.AUTH_COOKIE_SECURE:
            raise ValueError(
                "AUTH_COOKIE_SECURE must be true when DEBUG is false"
            )
        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.GENERATED_DIR.mkdir(parents=True, exist_ok=True)
