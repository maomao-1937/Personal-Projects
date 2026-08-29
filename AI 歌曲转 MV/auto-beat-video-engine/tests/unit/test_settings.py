import pytest
from pydantic import ValidationError

from backend.config import Settings


def test_settings_reject_audio_bounds_in_wrong_order(tmp_path) -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_database_path=tmp_path / "app.db",
            app_artifact_root=tmp_path / "artifacts",
            app_audio_min_seconds=61,
            app_audio_max_seconds=60,
            _env_file=None,
        )


def test_settings_keep_confirmed_30_day_asset_retention(tmp_path) -> None:
    settings = Settings(
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
        _env_file=None,
    )

    assert settings.app_asset_retention_days == 30
    assert settings.video_provider == "dashscope_wan"
    assert settings.video_base_url == "https://dashscope.aliyuncs.com"
    assert settings.video_model == "wanx2.1-t2v-turbo"

    with pytest.raises(ValidationError):
        Settings(
            app_database_path=tmp_path / "app.db",
            app_artifact_root=tmp_path / "artifacts",
            app_asset_retention_days=0,
            _env_file=None,
        )


def test_settings_safe_summary_never_contains_keys(tmp_path) -> None:
    settings = Settings(
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
        storyboard_api_key="storyboard-secret-value",
        video_api_key="video-secret-value",
        _env_file=None,
    )

    summary = repr(settings.safe_summary())

    assert "storyboard-secret-value" not in summary
    assert "video-secret-value" not in summary
    assert settings.safe_summary()["storyboard_api_key_configured"] is True
    assert settings.safe_summary()["video_api_key_configured"] is True


def test_settings_reject_unknown_video_provider(tmp_path) -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_database_path=tmp_path / "app.db",
            app_artifact_root=tmp_path / "artifacts",
            video_provider="unknown",
            _env_file=None,
        )
