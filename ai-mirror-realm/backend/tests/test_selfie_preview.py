from __future__ import annotations

from app.config import settings
from conftest import register_user


JPEG_BYTES = b"\xff\xd8\xff\xe0private-selfie-preview"


def upload(client) -> str:
    response = client.post(
        "/api/uploads/selfie",
        files={"file": ("portrait.jpg", JPEG_BYTES, "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    return response.json()["url"]


def test_owner_can_restore_private_selfie_preview(client, db_session_factory):
    register_user(client, db_session_factory, email="preview-owner@example.com")
    url = upload(client)

    response = client.get("/api/uploads/selfie", params={"url": url})

    assert response.status_code == 200, response.text
    assert response.content == JPEG_BYTES
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "private, no-store"
    assert client.get(url).status_code == 404


def test_selfie_preview_requires_session(client, db_session_factory):
    register_user(client, db_session_factory, email="preview-session@example.com")
    url = upload(client)
    client.post("/api/auth/logout")

    assert client.get("/api/uploads/selfie", params={"url": url}).status_code == 401


def test_other_user_cannot_read_uploaded_selfie(client, db_session_factory):
    register_user(client, db_session_factory, email="preview-first@example.com")
    url = upload(client)
    client.post("/api/auth/logout")
    register_user(client, db_session_factory, email="preview-second@example.com")

    response = client.get("/api/uploads/selfie", params={"url": url})

    assert response.status_code == 404
    assert response.json()["detail"] == "自拍照不存在"


def test_preview_rejects_traversal_and_symlinks(client, db_session_factory):
    user = register_user(client, db_session_factory, email="preview-traversal@example.com")["user"]
    own_dir = settings.UPLOAD_DIR / "selfies" / user["id"]
    own_dir.mkdir(parents=True, exist_ok=True)
    outside = settings.UPLOAD_DIR / "outside.jpg"
    outside.write_bytes(JPEG_BYTES)
    (own_dir / "link.jpg").symlink_to(outside)

    for url in (
        f"/uploads/selfies/{user['id']}/../../outside.jpg",
        f"/uploads/selfies/{user['id']}/link.jpg",
        f"/uploads/selfies/{user['id']}/missing.jpg",
        "/generated/outside.jpg",
    ):
        response = client.get("/api/uploads/selfie", params={"url": url})
        assert response.status_code == 404, (url, response.text)
