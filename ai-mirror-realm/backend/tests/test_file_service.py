import asyncio

import pytest
from fastapi import HTTPException

from app.config import settings
from app.services.file_service import save_upload


def test_upload_read_is_bounded_before_rejecting_oversized_file(monkeypatch):
    monkeypatch.setattr(settings, "MAX_FILE_SIZE", 8)

    class OversizedUpload:
        filename = "selfie.jpg"
        read_size = None

        async def read(self, size: int):
            self.read_size = size
            return b"x" * size

    file = OversizedUpload()
    with pytest.raises(HTTPException) as error:
        asyncio.run(save_upload(file))

    assert file.read_size == 9
    assert error.value.status_code == 413
