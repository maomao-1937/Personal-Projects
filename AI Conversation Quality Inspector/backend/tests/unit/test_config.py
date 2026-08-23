from importlib.util import find_spec

import pytest


def _settings_class():
    module_spec = find_spec("app.core.config")
    assert module_spec is not None, "app.core.config must exist"
    from app.core.config import Settings

    return Settings


def test_production_requires_session_and_invite_secrets() -> None:
    from pydantic import ValidationError

    settings_class = _settings_class()

    with pytest.raises(ValidationError):
        settings_class(environment="prod", session_secret="", invite_code_pepper="")


def test_production_sqlite_requires_s3_backup() -> None:
    from pydantic import ValidationError

    settings_class = _settings_class()

    with pytest.raises(ValidationError, match="STORAGE_PROVIDER=s3"):
        settings_class(
            environment="prod",
            database_url="sqlite:////tmp/data/app.db",
            session_secret="s" * 32,
            invite_code_pepper="p" * 32,
        )


def test_production_sqlite_accepts_complete_s3_backup_configuration() -> None:
    settings_class = _settings_class()

    settings = settings_class(
        environment="prod",
        database_url="sqlite:////tmp/data/app.db",
        storage_provider="s3",
        s3_endpoint="https://tos-s3-cn-beijing.volces.com",
        s3_region="cn-beijing",
        s3_bucket="conversation-qa-example",
        s3_access_key="test-access-key",
        s3_secret_key="test-secret-key",
        session_secret="s" * 32,
        invite_code_pepper="p" * 32,
    )

    assert settings.storage_provider == "s3"
    assert settings.sqlite_backup_interval_seconds == 300
    assert settings.sqlite_backup_max_age_seconds == 600


def test_production_sqlite_accepts_vefaas_request_credentials_without_static_keys() -> None:
    settings_class = _settings_class()

    settings = settings_class(
        environment="prod",
        database_url="sqlite:////tmp/data/app.db",
        storage_provider="s3",
        s3_auth_mode="vefaas_request",
        s3_endpoint="https://tos-s3-cn-beijing.volces.com",
        s3_region="cn-beijing",
        s3_bucket="conversation-qa-example",
        session_secret="s" * 32,
        invite_code_pepper="p" * 32,
    )

    assert settings.s3_auth_mode == "vefaas_request"
    assert settings.s3_access_key is None
    assert settings.s3_secret_key is None


def test_s3_backup_requires_all_credentials() -> None:
    from pydantic import ValidationError

    settings_class = _settings_class()

    with pytest.raises(ValidationError, match="S3 backup configuration"):
        settings_class(environment="test", storage_provider="s3")


def test_backup_health_window_must_cover_two_intervals() -> None:
    from pydantic import ValidationError

    settings_class = _settings_class()

    with pytest.raises(ValidationError, match="twice the backup interval"):
        settings_class(
            environment="test",
            sqlite_backup_interval_seconds=300,
            sqlite_backup_max_age_seconds=599,
        )


def test_llm_key_is_optional_before_real_smoke() -> None:
    settings_class = _settings_class()

    settings = settings_class(environment="test", database_url="sqlite:///:memory:")

    assert settings.llm_api_key is None
    assert settings.invite_usage_limit == 50


def test_doubao_reasoning_effort_and_max_tokens_are_loaded_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings_class = _settings_class()
    monkeypatch.setenv("LLM_REASONING_EFFORT", "minimal")
    monkeypatch.setenv("LLM_MAX_TOKENS", "3000")

    settings = settings_class(environment="test", database_url="sqlite:///:memory:")

    assert settings.llm_reasoning_effort == "minimal"
    assert settings.llm_max_tokens == 3000


def test_doubao_empty_reasoning_effort_means_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings_class = _settings_class()
    monkeypatch.setenv("LLM_REASONING_EFFORT", "")

    settings = settings_class(environment="test", database_url="sqlite:///:memory:")

    assert settings.llm_reasoning_effort is None


def test_doubao_rejects_invalid_reasoning_effort() -> None:
    from pydantic import ValidationError

    settings_class = _settings_class()

    with pytest.raises(ValidationError):
        settings_class(environment="test", llm_reasoning_effort="invalid")


@pytest.mark.parametrize("max_tokens", [0, -1])
def test_doubao_rejects_non_positive_max_tokens(max_tokens: int) -> None:
    from pydantic import ValidationError

    settings_class = _settings_class()

    with pytest.raises(ValidationError):
        settings_class(environment="test", llm_max_tokens=max_tokens)
