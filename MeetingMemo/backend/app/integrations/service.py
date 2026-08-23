from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.errors import DomainError
from app.core.security import fingerprint_value
from app.integrations.providers import DeliveryProvider
from app.meetings.models import Meeting
from app.summaries.exporters import export_markdown
from app.summaries.models import Delivery, SummaryVersion
from app.summaries.schemas import SummaryVersionResponse


@dataclass(slots=True)
class DeliveryResult:
    delivery: Delivery
    created: bool


class IntegrationService:
    def __init__(
        self,
        settings: Settings,
        session_factory: sessionmaker[Session],
        providers: dict[str, DeliveryProvider],
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.providers = providers

    def statuses(self) -> dict[str, str]:
        return {
            "slack": self._status("slack"),
            "email": self._status("email"),
            "zoom": "not_configured",
            "google_meet": "not_configured",
        }

    def deliver(self, summary_id: str, channel: str, target: str) -> DeliveryResult:
        provider = self.providers.get(channel)
        target_identity = getattr(provider, "target_identity", target)
        target_fingerprint = fingerprint_value(
            "delivery-target", target_identity, self.settings.secret_key
        )
        idempotency_key = fingerprint_value(
            "delivery",
            f"{summary_id}:{channel}:{target_fingerprint}",
            self.settings.secret_key,
        )
        with self.session_factory() as session:
            summary = session.get(SummaryVersion, summary_id)
            if summary is None:
                raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
            meeting = session.scalar(
                select(Meeting).where(
                    Meeting.id == summary.meeting_id,
                    Meeting.deleted_at.is_(None),
                )
            )
            if meeting is None:
                raise DomainError("SUMMARY_NOT_FOUND", "摘要版本不存在", 404)
            if summary.status != "approved":
                raise DomainError("SUMMARY_NOT_APPROVED", "摘要确认后才能分发", 409)
            latest_version = session.scalar(
                select(func.max(SummaryVersion.version)).where(
                    SummaryVersion.meeting_id == summary.meeting_id
                )
            )
            if summary.version != latest_version:
                raise DomainError("SUMMARY_NOT_LATEST", "只能分发最新摘要版本", 409)
            existing = session.scalar(
                select(Delivery).where(Delivery.idempotency_key == idempotency_key)
            )
            if existing is not None:
                if existing.status == "pending" and self._pending_expired(existing.created_at):
                    existing.status = "unknown"
                    existing.error_code = "DELIVERY_STATUS_UNKNOWN"
                    existing.error_message = "上次分发结果未知，请检查目标渠道后再操作"
                    session.commit()
                session.expunge(existing)
                return DeliveryResult(existing, created=False)
            if provider is None or not provider.configured:
                raise DomainError("INTEGRATION_NOT_CONFIGURED", "该分发渠道尚未配置", 409)
            meeting_title = meeting.title
            summary_response = SummaryVersionResponse.model_validate(summary)

        delivery = Delivery(
            summary_version_id=summary_id,
            channel=channel,
            target_fingerprint=target_fingerprint,
            idempotency_key=idempotency_key,
            status="pending",
            receipt={},
        )
        with self.session_factory() as session:
            session.add(delivery)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                existing = session.scalar(
                    select(Delivery).where(Delivery.idempotency_key == idempotency_key)
                )
                if existing is None:
                    raise
                session.expunge(existing)
                return DeliveryResult(existing, created=False)
            session.refresh(delivery)
            delivery_id = delivery.id

        content = export_markdown(meeting_title, summary_response)
        try:
            receipt = provider.send(content)
        except DomainError as error:
            self._mark_failed(delivery_id, error.code, error.message)
            raise
        except Exception as error:
            safe_error = DomainError("DELIVERY_FAILED", "分发服务暂时不可用", 502)
            self._mark_failed(delivery_id, safe_error.code, safe_error.message)
            raise safe_error from error

        with self.session_factory.begin() as session:
            stored = session.get(Delivery, delivery_id)
            if stored is None:
                raise DomainError("DELIVERY_NOT_FOUND", "分发记录不存在", 404)
            stored.status = "succeeded"
            stored.receipt = receipt
            session.flush()
            session.expunge(stored)
            return DeliveryResult(stored, created=True)

    def _mark_failed(self, delivery_id: str, code: str, message: str) -> None:
        with self.session_factory.begin() as session:
            stored = session.get(Delivery, delivery_id)
            if stored is not None:
                stored.status = "failed"
                stored.error_code = code
                stored.error_message = message

    def _status(self, channel: str) -> str:
        provider = self.providers.get(channel)
        return "configured" if provider is not None and provider.configured else "not_configured"

    def _pending_expired(self, created_at: datetime) -> bool:
        normalized = created_at
        if normalized.tzinfo is None:
            normalized = normalized.replace(tzinfo=UTC)
        return normalized <= datetime.now(UTC) - timedelta(
            seconds=self.settings.delivery_pending_timeout_seconds
        )
