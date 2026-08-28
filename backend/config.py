import shutil
from pathlib import Path
from typing import Any

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = BASE_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_database_path: Path = REPOSITORY_ROOT / "data" / "app.db"
    app_artifact_root: Path = REPOSITORY_ROOT / "artifacts"
    app_upload_max_bytes: int = 100 * 1024 * 1024
    app_audio_min_seconds: int = 30
    app_audio_max_seconds: int = 60
    app_cut_max_count: int = 12
    app_video_concurrency: int = 2
    app_session_ttl_seconds: int = 7 * 24 * 60 * 60
    app_invite_code_hashes: str = ""

    storyboard_provider: str = "openai_compatible"
    storyboard_api_key: SecretStr | None = None
    storyboard_base_url: str = ""
    storyboard_model: str = ""
    storyboard_timeout_seconds: float = 60.0
    storyboard_max_attempts: int = 3

    video_provider: str = "volcengine_ark"
    video_api_key: SecretStr | None = None
    video_base_url: str = ""
    video_model: str = ""
    video_request_timeout_seconds: float = 30.0
    video_job_deadline_seconds: int = 1200
    video_poll_interval_seconds: float = 10.0

    transcription_provider: str = "disabled"
    transcription_api_key: SecretStr | None = None
    transcription_base_url: str = ""
    transcription_model: str = ""

    render_job_deadline_seconds: int = 600

    @model_validator(mode="after")
    def validate_product_limits(self) -> "Settings":
        if self.app_audio_min_seconds > self.app_audio_max_seconds:
            raise ValueError("app_audio_min_seconds cannot exceed app_audio_max_seconds")
        if not 1 <= self.app_cut_max_count <= 12:
            raise ValueError("app_cut_max_count must be between 1 and 12")
        if not 1 <= self.app_video_concurrency <= 2:
            raise ValueError("app_video_concurrency must be between 1 and 2")
        return self

    def safe_summary(self) -> dict[str, Any]:
        return {
            "app_env": self.app_env,
            "storyboard_provider": self.storyboard_provider,
            "storyboard_model": self.storyboard_model,
            "storyboard_api_key_configured": self.storyboard_api_key is not None,
            "video_provider": self.video_provider,
            "video_model": self.video_model,
            "video_api_key_configured": self.video_api_key is not None,
            "transcription_provider": self.transcription_provider,
            "transcription_api_key_configured": self.transcription_api_key is not None,
        }


settings = Settings()

UPLOAD_DIR = str(settings.app_artifact_root / "uploads")
OUTPUT_DIR = str(settings.app_artifact_root / "output")

FFMPEG_BIN = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE_BIN = shutil.which("ffprobe") or "ffprobe"

MAX_UPLOAD_SIZE = settings.app_upload_max_bytes
