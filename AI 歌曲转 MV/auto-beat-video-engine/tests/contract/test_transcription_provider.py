from pathlib import Path

import pytest

from backend.domain.errors import DomainError
from backend.providers.transcription_disabled import DisabledTranscriptionProvider


def test_disabled_transcription_provider_is_explicit_and_non_blocking_to_configuration() -> None:
    provider = DisabledTranscriptionProvider()

    with pytest.raises(DomainError) as failure:
        provider.transcribe(Path("unused.wav"))

    assert failure.value.code == "transcription_disabled"
    assert failure.value.status_code == 409
    assert failure.value.retryable is False
