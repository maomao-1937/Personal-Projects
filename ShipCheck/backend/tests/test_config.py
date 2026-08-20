from app.core.config import settings


def test_mock_mode_on():
    assert settings.mock_mode is True


def test_db_url_is_test():
    assert "test.db" in settings.db_url
