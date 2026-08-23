import smtplib
import ssl
from email.message import EmailMessage
from typing import Protocol

import httpx

from app.core.config import Settings
from app.core.errors import DomainError


class DeliveryProvider(Protocol):
    configured: bool
    target_identity: str

    def send(self, content: str) -> dict[str, object]: ...


class DisabledDeliveryProvider:
    configured = False
    target_identity = "not-configured"

    def send(self, content: str) -> dict[str, object]:
        del content
        raise DomainError("INTEGRATION_NOT_CONFIGURED", "该分发渠道尚未配置", 409)


class SlackWebhookProvider:
    def __init__(self, webhook_url: str | None, timeout_seconds: float = 10.0) -> None:
        self.webhook_url = webhook_url
        self.timeout_seconds = timeout_seconds
        self.configured = bool(webhook_url)
        self.target_identity = webhook_url or "not-configured"

    def send(self, content: str) -> dict[str, object]:
        if not self.webhook_url:
            raise DomainError("INTEGRATION_NOT_CONFIGURED", "Slack 尚未配置", 409)
        try:
            response = httpx.post(
                self.webhook_url,
                json={"text": content},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except (httpx.HTTPError, OSError) as error:
            raise DomainError("DELIVERY_FAILED", "Slack 分发暂时不可用", 502) from error
        return {"delivered": True, "provider_status": response.status_code}


class SmtpEmailProvider:
    def __init__(self, settings: Settings) -> None:
        self.host = settings.smtp_host
        self.port = settings.smtp_port
        self.username = settings.smtp_username
        self.password = settings.smtp_password
        self.from_email = settings.smtp_from_email
        self.to_email = settings.email_default_to
        self.use_tls = settings.smtp_use_tls
        self.configured = all([self.host, self.from_email, self.to_email])
        self.target_identity = self.to_email or "not-configured"

    def send(self, content: str) -> dict[str, object]:
        if not self.configured or not self.host or not self.from_email or not self.to_email:
            raise DomainError("INTEGRATION_NOT_CONFIGURED", "邮件分发尚未配置", 409)

        message = EmailMessage()
        message["Subject"] = "MeetingMemo 会议纪要"
        message["From"] = self.from_email
        message["To"] = self.to_email
        message.set_content(content)
        try:
            with smtplib.SMTP(self.host, self.port, timeout=10) as client:
                if self.use_tls:
                    client.starttls(context=ssl.create_default_context())
                if self.username and self.password:
                    client.login(self.username, self.password)
                client.send_message(message)
        except (OSError, smtplib.SMTPException) as error:
            raise DomainError("DELIVERY_FAILED", "邮件分发暂时不可用", 502) from error
        return {"delivered": True}


def build_delivery_providers(settings: Settings) -> dict[str, DeliveryProvider]:
    return {
        "slack": SlackWebhookProvider(settings.slack_webhook_url),
        "email": SmtpEmailProvider(settings),
    }
