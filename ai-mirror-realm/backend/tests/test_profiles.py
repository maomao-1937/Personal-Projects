from __future__ import annotations

import pytest

from app.models.portrait import PortraitTask
from app.models.style import Style
from conftest import register_user


SELFIE_BYTES = b"\xff\xd8\xffprofile-selfie"


def upload(client) -> str:
    response = client.post(
        "/api/uploads/selfie",
        files={"file": ("selfie.jpg", SELFIE_BYTES, "image/jpeg")},
    )
    assert response.status_code == 201
    return response.json()["url"]


def test_profile_can_be_stored_renamed_and_deleted_without_deleting_selfie(client, db_session_factory):
    user = register_user(client, db_session_factory, email="profile-owner@example.com")["user"]
    selfie_url = upload(client)
    created = client.post("/api/profiles", json={"name": "  我的自拍  ", "selfie_url": selfie_url})
    assert created.status_code == 201, created.text
    profile = created.json()
    assert set(profile) == {"id", "name", "selfie_url", "selfie_urls", "created_at"}
    assert profile["name"] == "我的自拍"
    assert profile["selfie_url"] == selfie_url
    assert client.get("/api/profiles").json() == [profile]

    updated = client.patch(f"/api/profiles/{profile['id']}", json={"name": "  证件照自拍  "})
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "证件照自拍"
    assert updated.json()["id"] == profile["id"]

    with db_session_factory() as db:
        style_id = db.query(Style.id).first()[0]
        task = PortraitTask(user_id=user["id"], style_id=style_id, selfie_url=selfie_url, status="pending")
        db.add(task)
        db.commit()
        task_id = task.id

    assert client.delete(f"/api/profiles/{profile['id']}").status_code == 204
    assert client.get("/api/profiles").json() == []
    assert client.get("/api/uploads/selfie", params={"url": selfie_url}).content == SELFIE_BYTES
    assert client.get(f"/api/portraits/{task_id}").json()["selfie_url"] == selfie_url


def test_profile_routes_require_session(client):
    assert client.get("/api/profiles").status_code == 401
    assert client.post("/api/profiles", json={"name": "自拍", "selfie_url": "/uploads/selfies/unknown/selfie.jpg"}).status_code == 401


def test_profiles_and_selfies_are_private_to_their_account(client, db_session_factory):
    register_user(client, db_session_factory, email="profile-first@example.com")
    selfie_url = upload(client)
    created = client.post("/api/profiles", json={"name": "我的档案", "selfie_url": selfie_url})
    assert created.status_code == 201
    profile_id = created.json()["id"]
    client.post("/api/auth/logout")
    register_user(client, db_session_factory, email="profile-second@example.com")

    assert client.get("/api/profiles").json() == []
    assert client.patch(f"/api/profiles/{profile_id}", json={"name": "窃取"}).status_code == 404
    assert client.delete(f"/api/profiles/{profile_id}").status_code == 404
    assert client.post("/api/profiles", json={"name": "窃取", "selfie_url": selfie_url}).status_code == 400


@pytest.mark.parametrize("invalid_url", [
    "/uploads/selfies/../outside.jpg",
    "/uploads/selfies/unknown/missing.jpg",
    "/generated/result.jpg",
    "https://example.com/selfie.jpg",
])
def test_profile_rejects_missing_or_outside_selfies(client, db_session_factory, invalid_url):
    register_user(client, db_session_factory, email="profile-invalid-path@example.com")
    response = client.post("/api/profiles", json={"name": "自拍", "selfie_url": invalid_url})
    assert response.status_code == 400
    assert client.get("/api/profiles").json() == []


@pytest.mark.parametrize("name", ["", "   ", "字" * 31])
def test_profile_name_has_meaningful_length_limit(client, db_session_factory, name):
    register_user(client, db_session_factory, email="profile-name@example.com")
    selfie_url = upload(client)
    response = client.post("/api/profiles", json={"name": name, "selfie_url": selfie_url})
    assert response.status_code == 400
