from backend.app import _DisabledVideoProvider, _video_provider
from backend.config import Settings
from backend.providers.video_ark import ArkVideoProvider
from backend.providers.video_wan import DashScopeWanVideoProvider


def test_default_config_selects_dashscope_wan(tmp_path) -> None:
    config = Settings(
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
        video_api_key="private-key",
        _env_file=None,
    )

    assert isinstance(_video_provider(config), DashScopeWanVideoProvider)


def test_ark_provider_remains_selectable(tmp_path) -> None:
    config = Settings(
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
        video_provider="volcengine_ark",
        video_api_key="private-key",
        video_base_url="https://ark.example/api/v3",
        video_model="seedance-model",
        _env_file=None,
    )

    assert isinstance(_video_provider(config), ArkVideoProvider)


def test_missing_key_keeps_video_provider_disabled(tmp_path) -> None:
    config = Settings(
        app_database_path=tmp_path / "app.db",
        app_artifact_root=tmp_path / "artifacts",
        video_api_key=None,
        _env_file=None,
    )

    assert isinstance(_video_provider(config), _DisabledVideoProvider)
