import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

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


@pytest.mark.parametrize(
    "filename, content",
    [
        ("selfie.jpg", b""),
        ("selfie.jpg", b"<html>not a photo</html>"),
        ("selfie.png", b"\xff\xd8\xff\xe0jpeg-data"),
        ("selfie.webp", b"RIFFxxxxnot-webp"),
    ],
)
def test_upload_rejects_empty_or_mismatched_image_content(filename, content):
    file = UploadFile(file=BytesIO(content), filename=filename)

    with pytest.raises(HTTPException) as error:
        asyncio.run(save_upload(file))

    assert error.value.status_code == 400
