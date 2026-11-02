from __future__ import annotations

from app.models.portrait import PortraitTask
from app.models.profile import FaceProfile
from conftest import register_user


def upload_many(client, count: int) -> list[str]:
    urls = []
    for index in range(count):
        response = client.post("/api/uploads/selfie", files={"file": (f"photo-{index}.jpg", b"\xff\xd8\xff" + str(index).encode(), "image/jpeg")})
        assert response.status_code == 201
        urls.append(response.json()["url"])
    return urls


def test_four_photo_profile_survives_rename_and_delete_keeps_images(client, db_session_factory):
    register_user(client, db_session_factory, email="four-profile@example.com")
    urls = upload_many(client, 4)
    created = client.post("/api/profiles", json={"name": "完整档案", "selfie_urls": urls})
    assert created.status_code == 201, created.text
    profile = created.json()
    assert profile["selfie_url"] == urls[0]
    assert profile["selfie_urls"] == urls
    assert client.patch(f"/api/profiles/{profile['id']}", json={"name": "我的档案"}).json()["selfie_urls"] == urls
    assert client.get("/api/profiles").json()[0]["selfie_urls"] == urls
    assert client.delete(f"/api/profiles/{profile['id']}").status_code == 204
    for url in urls:
        assert client.get("/api/uploads/selfie", params={"url": url}).status_code == 200


def test_profile_rejects_foreign_photo_in_group_and_over_nine(client, db_session_factory):
    register_user(client, db_session_factory, email="foreign-multi@example.com")
    foreign = upload_many(client, 1)[0]
    client.post("/api/auth/logout")
    register_user(client, db_session_factory, email="own-multi@example.com")
    own = upload_many(client, 4)
    assert client.post("/api/profiles", json={"name": "越权", "selfie_urls": own + [foreign]}).status_code == 400
    assert client.post("/api/profiles", json={"name": "超量", "selfie_urls": own * 3}).status_code == 400
    assert client.get("/api/profiles").json() == []


def test_portrait_restores_entire_photo_group_and_passes_all_paths(client, db_session_factory, monkeypatch):
    from app.routers import portraits

    register_user(client, db_session_factory, email="multi-portrait@example.com")
    urls = upload_many(client, 4)
    captured = {}
    monkeypatch.setattr(portraits.ai_service, "model", "doubao-seedream-4-5-251128")
    monkeypatch.setattr(portraits.ai_service, "base_url", "https://ark.cn-beijing.volces.com")
    monkeypatch.setattr(portraits.prompt_analysis_service, "analyze", lambda *_: None)

    def generate(path, prompt, negative_prompt="", reference_path=None, identity_paths=None):
        captured.update(paths=identity_paths, prompt=prompt)
        return b"\x89PNG\r\n\x1a\nresult"

    monkeypatch.setattr(portraits.ai_service, "generate_portrait_sync", generate)
    response = client.post("/api/portraits", json={"selfie_url": urls[0], "selfie_urls": urls, "user_prompt": "自然写真"})
    assert response.status_code == 201, response.text
    assert len(captured["paths"]) == 4
    assert "first 4 images" in captured["prompt"]
    task_id = response.json()["id"]
    assert response.json()["selfie_urls"] == urls
    assert client.get(f"/api/portraits/{task_id}").json()["selfie_urls"] == urls
    assert client.get("/api/portraits").json()[0]["selfie_urls"] == urls


def test_portrait_rejects_mismatched_primary_and_foreign_group_member(client, db_session_factory):
    register_user(client, db_session_factory, email="foreign-portrait-group@example.com")
    foreign = upload_many(client, 1)[0]
    client.post("/api/auth/logout")
    register_user(client, db_session_factory, email="own-portrait-group@example.com")
    urls = upload_many(client, 4)
    for group in ([urls[1], urls[0]], urls + [foreign], urls * 3):
        assert client.post("/api/portraits", json={"selfie_url": urls[0], "selfie_urls": group, "user_prompt": "自然写真"}).status_code == 400
    assert client.get("/api/portraits").json() == []


def test_legacy_records_fall_back_to_primary_selfie(client, db_session_factory):
    from app.models.style import Style

    user = register_user(client, db_session_factory, email="legacy-group@example.com")["user"]
    url = upload_many(client, 1)[0]
    with db_session_factory() as db:
        style_id = db.query(Style.id).first()[0]
        db.add(FaceProfile(user_id=user["id"], name="旧档案", selfie_url=url))
        db.add(PortraitTask(user_id=user["id"], style_id=style_id, selfie_url=url, status="failed"))
        db.commit()
    assert client.get("/api/profiles").json()[0]["selfie_urls"] == [url]
    assert client.get("/api/portraits").json()[0]["selfie_urls"] == [url]


def test_portrait_snapshots_owned_profile_name_even_after_rename_and_delete(client, db_session_factory, monkeypatch):
    monkeypatch.setattr("app.routers.portraits.prompt_analysis_service.analyze", lambda *_: None)
    register_user(client, db_session_factory, email="profile-snapshot@example.com")
    urls = upload_many(client, 4)
    profile = client.post("/api/profiles", json={"name": "我的写真档案", "selfie_urls": urls}).json()

    created = client.post("/api/portraits", json={"selfie_url": urls[0], "selfie_urls": urls, "user_prompt": "自然写真"})

    assert created.status_code == 201, created.text
    assert created.json()["profile_name"] == "我的写真档案"
    task_id = created.json()["id"]
    assert client.patch(f"/api/profiles/{profile['id']}", json={"name": "新名称"}).status_code == 200
    assert client.delete(f"/api/profiles/{profile['id']}").status_code == 204
    assert client.get(f"/api/portraits/{task_id}").json()["profile_name"] == "我的写真档案"
    assert client.get("/api/portraits").json()[0]["profile_name"] == "我的写真档案"


def test_single_upload_has_no_profile_name_and_ignores_other_accounts_profile(client, db_session_factory, monkeypatch):
    monkeypatch.setattr("app.routers.portraits.prompt_analysis_service.analyze", lambda *_: None)
    other = register_user(client, db_session_factory, email="foreign-profile-name@example.com")["user"]
    client.post("/api/auth/logout")
    register_user(client, db_session_factory, email="own-profile-name@example.com")
    url = upload_many(client, 1)[0]
    # Corrupt or imported foreign metadata must not disclose a different account's name.
    with db_session_factory() as db:
        db.add(FaceProfile(user_id=other["id"], name="别人的档案名", selfie_url=url))
        db.commit()

    created = client.post("/api/portraits", json={"selfie_url": url, "user_prompt": "自然写真"})

    assert created.status_code == 201, created.text
    assert created.json()["profile_name"] is None
    assert client.get(f"/api/portraits/{created.json()['id']}").json()["profile_name"] is None
