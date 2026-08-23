from app.core.config import Settings
from app.main import create_app
from scripts import check_production_config
from scripts.check_production_config import render_config_status


def test_settings_ignore_platform_app_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "volcengine_cnbeijingprod_new")
    monkeypatch.setenv("MEETINGMEMO_APP_ENV", "development")

    settings = Settings(_env_file=None)

    assert settings.app_env == "development"


def test_production_check_lists_names_not_values():
    secret_value = "super-secret-value-that-must-not-be-printed"
    settings = Settings(
        _env_file=None,
        app_env="production",
        llm_api_key=secret_value,
    )

    output = render_config_status(settings)

    assert secret_value not in output
    assert "DATABASE_URL" in output
    assert "SECRET_KEY" in output
    assert "FRONTEND_ORIGIN" in output
    assert "LLM_PROVIDER" in output
    assert "LLM_BASE_URL" in output
    assert "LLM_MODEL" in output
    assert "LLM_API_KEY" not in output
    assert "ALLOW_ORIGINLESS_STATE_CHANGES" not in output


def test_production_check_redacts_short_secret_value():
    short_secret = "short-private-value"
    settings = Settings(
        _env_file=None,
        app_env="production",
        secret_key=short_secret,
    )

    output = render_config_status(settings)

    assert "SECRET_KEY" in output
    assert short_secret not in output


def test_production_check_returns_ok_for_safe_configuration():
    settings = Settings(
        _env_file=None,
        app_env="production",
        database_url="postgresql+psycopg://meetingmemo:password@db:5432/meetingmemo",
        frontend_origin="https://meetingmemo.example.com",
        secret_key="production-secret-key-with-at-least-32-bytes",
        llm_provider="openai-compatible",
        llm_api_key="configured-but-never-rendered",
        llm_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        llm_model="qwen-plus",
    )

    assert render_config_status(settings) == "ok"


def test_production_check_rejects_insecure_outbound_transports():
    settings = Settings(
        _env_file=None,
        app_env="production",
        database_url="postgresql+psycopg://meetingmemo:password@db:5432/meetingmemo",
        frontend_origin="https://meetingmemo.example.com",
        secret_key="production-secret-key-with-at-least-32-bytes",
        llm_provider="openai-compatible",
        llm_api_key="configured-but-never-rendered",
        llm_base_url="http://model.example.com/v1",
        llm_model="provider-model",
        slack_webhook_url="http://hooks.slack.com/services/example",
        smtp_host="smtp.example.com",
        smtp_from_email="meetingmemo@example.com",
        email_default_to="notes@example.com",
        smtp_use_tls=False,
    )

    missing = settings.missing_production_secrets()

    assert "LLM_BASE_URL" in missing
    assert "SLACK_WEBHOOK_URL" in missing
    assert "SMTP_USE_TLS" in missing


def test_production_check_requires_explicit_production_environment():
    settings = Settings(_env_file=None, app_env="development")

    assert "MEETINGMEMO_APP_ENV" in render_config_status(settings)


def test_production_config_command_fails_when_configuration_is_incomplete(monkeypatch, capsys):
    monkeypatch.setattr(
        check_production_config,
        "Settings",
        lambda: Settings(_env_file=None, app_env="development"),
    )

    exit_code = check_production_config.main()

    assert exit_code == 1
    assert "missing:" in capsys.readouterr().out


def test_production_check_rejects_originless_write_override():
    settings = Settings(
        _env_file=None,
        app_env="production",
        allow_originless_state_changes=True,
    )

    assert "ALLOW_ORIGINLESS_STATE_CHANGES" in render_config_status(settings)


def test_application_fails_closed_with_unsafe_production_configuration():
    settings = Settings(
        _env_file=None,
        app_env="production",
        llm_api_key="must-not-appear-in-error",
    )

    try:
        create_app(settings=settings, start_runner=False)
    except RuntimeError as error:
        rendered = str(error)
    else:
        raise AssertionError("unsafe production configuration was accepted")

    assert "must-not-appear-in-error" not in rendered
    assert "DATABASE_URL" in rendered
    assert "SECRET_KEY" in rendered
