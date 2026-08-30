import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "AI 镜界"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./mirror_realm.db"

    SECRET_KEY: str = "mirror-realm-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    UPLOAD_DIR: Path = Path(__file__).resolve().parent.parent / "uploads"
    GENERATED_DIR: Path = Path(__file__).resolve().parent.parent / "generated"

    AI_API_KEY: str = ""
    AI_API_BASE_URL: str = "https://tokenhub.tencentmaas.com"
    AI_MODEL: str = "hy-image-v3"

    MAX_FILE_SIZE: int = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS: set[str] = {"jpg", "jpeg", "png", "webp"}

    FREE_CREDITS: int = 3

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.GENERATED_DIR.mkdir(parents=True, exist_ok=True)
