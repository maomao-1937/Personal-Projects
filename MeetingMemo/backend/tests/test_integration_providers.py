import ssl

from app.core.config import Settings
from app.integrations.providers import SmtpEmailProvider


def test_smtp_starttls_verifies_server_certificate(monkeypatch):
    class FakeSmtp:
        instance = None

        def __init__(self, host, port, timeout):
            self.host = host
            self.port = port
            self.timeout = timeout
            self.tls_context = None
            FakeSmtp.instance = self

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            del exc_type, exc_value, traceback

        def starttls(self, *, context):
            self.tls_context = context

        def login(self, username, password):
            del username, password

        def send_message(self, message):
            del message

    monkeypatch.setattr("app.integrations.providers.smtplib.SMTP", FakeSmtp)
    provider = SmtpEmailProvider(
        Settings(
            _env_file=None,
            smtp_host="smtp.example.com",
            smtp_username="meetingmemo",
            smtp_password="private-password",
            smtp_from_email="meetingmemo@example.com",
            email_default_to="notes@example.com",
            smtp_use_tls=True,
        )
    )

    provider.send("Meeting notes")

    assert FakeSmtp.instance is not None
    assert FakeSmtp.instance.tls_context is not None
    assert FakeSmtp.instance.tls_context.verify_mode == ssl.CERT_REQUIRED
    assert FakeSmtp.instance.tls_context.check_hostname is True
