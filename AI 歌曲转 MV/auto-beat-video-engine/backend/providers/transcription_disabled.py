from pathlib import Path

from backend.domain.errors import DomainError
from backend.providers.protocols import TranscriptionResult


class DisabledTranscriptionProvider:
    def transcribe(self, audio_path: str | Path) -> TranscriptionResult:
        raise DomainError(
            "transcription_disabled",
            "P0 未启用歌词转写，不影响无歌词的 MV 主链路。",
            status_code=409,
            retryable=False,
        )
