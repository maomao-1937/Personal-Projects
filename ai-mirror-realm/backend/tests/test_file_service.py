import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from app.config import settings
from app.services.file_service import save_generated_image, save_upload


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


@pytest.mark.parametrize(
    "content, suffix",
    [
        (b"\xff\xd8\xffjpeg-data", ".jpg"),
        (b"\x89PNG\r\n\x1a\nimage-data", ".png"),
        (b"RIFFxxxxWEBPimage-data", ".webp"),
    ],
)
def test_generated_image_uses_verified_image_format(tmp_path, monkeypatch, content, suffix):
    monkeypatch.setattr(settings, "GENERATED_DIR", tmp_path)

    result = save_generated_image(content)

    assert result.endswith(suffix)
    assert (tmp_path / result.rsplit("/", 1)[-1]).read_bytes() == content


@pytest.mark.parametrize("content", [b"", b"<svg/>", b"<html>error</html>", b"\x89PNGbad"])
def test_generated_image_rejects_non_image_content_without_writing(tmp_path, monkeypatch, content):
    monkeypatch.setattr(settings, "GENERATED_DIR", tmp_path)

    with pytest.raises(ValueError):
        save_generated_image(content)

    assert list(tmp_path.iterdir()) == []


def test_generated_image_rejects_mismatched_declared_extension(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "GENERATED_DIR", tmp_path)

    with pytest.raises(ValueError):
        save_generated_image(b"\x89PNG\r\n\x1a\nimage-data", ext="jpg")

    assert list(tmp_path.iterdir()) == []
