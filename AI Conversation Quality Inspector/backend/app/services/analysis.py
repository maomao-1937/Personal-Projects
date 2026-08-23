from time import perf_counter
from typing import Protocol

from app.core.config import Settings
from app.core.errors import AppError, BackupUnavailable, IdempotencyConflict
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.model_client import AnalysisModel
from app.services.quotas import CompletionMetadata, QuotaReservation, QuotaService
from app.services.reporting import build_report
from app.services.transcript import TranscriptLimits, parse_transcript


class BackupHealth(Protocol):
    def is_healthy(self, *, max_age_seconds: int) -> bool: ...


class AnalysisService:
    def __init__(
        self,
        settings: Settings,
        quota_service: QuotaService,
        model: AnalysisModel,
        *,
        backup_health: BackupHealth | None = None,
    ) -> None:
        self._settings = settings
        self.quota_service = quota_service
        self._model = model
        self._backup_health = backup_health
        self._limits = TranscriptLimits(
            min_chars=settings.min_transcript_chars,
            max_chars=settings.max_transcript_chars,
            max_turns=settings.max_turns,
        )

    def analyze(
        self,
        invite_id: str,
        idempotency_key: str,
        request: AnalysisRequest,
    ) -> AnalysisResponse:
        self._model.ensure_configured()
        transcript = parse_transcript(
            request.transcript,
            request.qa_type,
            self._limits,
        )
        reservation = self.quota_service.reserve(
            invite_id,
            idempotency_key,
            request.qa_type,
            transcript.char_count,
            transcript.turn_count,
        )
        if not reservation.is_new:
            raise IdempotencyConflict()

        started_at = perf_counter()
        settled = False
        try:
            model_result = self._model.analyze(transcript, request.qa_type)
            report = build_report(model_result, transcript)
            latency_ms = max(round((perf_counter() - started_at) * 1000), 0)
            if self._backup_health is not None and not self._backup_health.is_healthy(
                max_age_seconds=self._settings.sqlite_backup_max_age_seconds
            ):
                raise BackupUnavailable()
            self.quota_service.consume(
                reservation.id,
                CompletionMetadata(
                    analysis_status=report.analysis_status,
                    latency_ms=latency_ms,
                    model_version=self._model.model_version,
                    scored_dimension_count=report.scored_dimension_count,
                    risk_level=report.risk_level,
                ),
            )
            settled = True
            return AnalysisResponse(
                **report.model_dump(),
                analysis_id=reservation.id,
                remaining_uses=self.quota_service.remaining(invite_id),
                rubric_version=self._settings.rubric_version,
                prompt_version=self._settings.prompt_version,
                model_version=self._model.model_version,
            )
        except Exception as exc:
            if not settled:
                self._release_failed_reservation(reservation, exc)
            raise

    def _release_failed_reservation(
        self,
        reservation: QuotaReservation,
        exc: Exception,
    ) -> None:
        error_type = exc.code if isinstance(exc, AppError) else "INTERNAL_ERROR"
        try:
            self.quota_service.release(reservation.id, error_type[:80])
        except AppError:
            # Preserve the original model/report failure. A later stale-reservation
            # sweep provides a second safety net if the counter transition failed.
            return
