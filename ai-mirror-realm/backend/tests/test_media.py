from __future__ import annotations

from datetime import datetime

from app.config import settings
from app.models.portrait import PortraitTask
from app.models.style import Style
from conftest import register_user


def create_completed_portrait(db_session_factory, user_id: str) -> PortraitTask:
    with db_session_factory() as db:
        style_id = db.query(Style.id).order_by(Style.sort_order).first()[0]
        result_path = settings.GENERATED_DIR / "private-result.png"
        result_path.write_bytes(b"\x89PNG\r\n\x1a\nprivate")
        portrait = PortraitTask(
            user_id=user_id,
            style_id=style_id,
            selfie_url=f"/uploads/selfies/{user_id}/selfie.jpg",
            result_url="/generated/private-result.png",
            status="completed",
            credits_used=0,
            completed_at=datetime.utcnow(),
        )
        db.add(portrait)
        db.commit()
        db.refresh(portrait)
        portrait_id = portrait.id

    with db_session_factory() as db:
        return db.query(PortraitTask).filter(PortraitTask.id == portrait_id).one()


def test_result_media_requires_authentication(client, db_session_factory):
    user_data = register_user(client, db_session_factory, email="media-owner@example.com")
    portrait = create_completed_portrait(db_session_factory, user_data["user"]["id"])
    client.post("/api/auth/logout")

    response = client.get(f"/api/media/portraits/{portrait.id}")

    assert response.status_code == 401


def test_result_media_is_available_to_owner(client, db_session_factory):
    user_data = register_user(client, db_session_factory, email="owner-media@example.com")
    portrait = create_completed_portrait(db_session_factory, user_data["user"]["id"])

    response = client.get(f"/api/media/portraits/{portrait.id}")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert response.content.startswith(b"\x89PNG")


def test_result_media_hides_other_users_portrait(client, db_session_factory):
    owner = register_user(client, db_session_factory, email="media-a@example.com")
    portrait = create_completed_portrait(db_session_factory, owner["user"]["id"])
    client.post("/api/auth/logout")
    register_user(client, db_session_factory, email="media-b@example.com")

    response = client.get(f"/api/media/portraits/{portrait.id}")

    assert response.status_code == 404


def test_public_static_result_path_is_not_mounted(client, db_session_factory):
    user = register_user(client, db_session_factory, email="static@example.com")
    create_completed_portrait(db_session_factory, user["user"]["id"])

    assert client.get("/generated/private-result.png").status_code == 404


def test_portrait_api_exposes_private_media_url_not_storage_path(
    client, db_session_factory
):
    user = register_user(client, db_session_factory, email="media-url@example.com")
    portrait = create_completed_portrait(db_session_factory, user["user"]["id"])

    response = client.get(f"/api/portraits/{portrait.id}")

    assert response.status_code == 200
    assert response.json()["result_url"] == f"/api/media/portraits/{portrait.id}"
    assert "/generated/" not in response.text
