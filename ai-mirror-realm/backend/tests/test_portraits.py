from __future__ import annotations

from app.models.style import Style
from app.models.portrait import PortraitTask
from conftest import register_user


def jpeg_bytes() -> bytes:
    return b"\xff\xd8\xff\xe0mock-jpeg"


def upload_selfie(client) -> str:
    upload = client.post(
        "/api/uploads/selfie",
        files={"file": ("selfie.jpg", jpeg_bytes(), "image/jpeg")},
    )
    assert upload.status_code == 201, upload.text
    return upload.json()["url"]


def test_portrait_requires_prompt_or_style(client, db_session_factory):
    register_user(client, db_session_factory, email="direction-required@example.com")

    response = client.post(
        "/api/portraits",
        json={"selfie_url": upload_selfie(client), "style_id": None, "user_prompt": "   "},
    )

    assert response.status_code == 400
    assert "请输入写真描述或选择一个主题" in response.text


def test_custom_prompt_only_uses_server_system_prompt(client, db_session_factory):
    from app.routers import portraits

    register_user(client, db_session_factory, email="custom-prompt@example.com")
    response = client.post(
        "/api/portraits",
        json={
            "selfie_url": upload_selfie(client),
            "user_prompt": "雨夜街头，黑色风衣，电影感侧光",
        },
    )

    assert response.status_code == 201, response.text
    task_id = response.json()["id"]
    assert response.json()["style_id"] == portraits.CUSTOM_STYLE_ID
    with db_session_factory() as db:
        task = db.query(PortraitTask).filter(PortraitTask.id == task_id).one()
        assert portraits.SYSTEM_PORTRAIT_PROMPT in task.prompt_used
        assert "雨夜街头，黑色风衣，电影感侧光" in task.prompt_used


def test_style_and_custom_prompt_are_combined_with_system_prompt(client, db_session_factory):
    from app.routers import portraits

    register_user(client, db_session_factory, email="combined-direction@example.com")
    with db_session_factory() as db:
        style = db.query(Style).order_by(Style.sort_order).first()
        style_id = style.id
        style_prompt = style.prompt_template

    response = client.post(
        "/api/portraits",
        json={
            "selfie_url": upload_selfie(client),
            "style_id": style_id,
            "user_prompt": "保留眼镜，背景加入细雨",
        },
    )

    assert response.status_code == 201, response.text
    with db_session_factory() as db:
        task = db.query(PortraitTask).filter(PortraitTask.id == response.json()["id"]).one()
        assert portraits.SYSTEM_PORTRAIT_PROMPT in task.prompt_used
        assert style_prompt in task.prompt_used
        assert "保留眼镜，背景加入细雨" in task.prompt_used


def test_generation_has_no_billing_fields(client, db_session_factory):
    user_data = register_user(client, db_session_factory, email="portrait@example.com")
    assert "credits" not in user_data["user"]

    upload = client.post(
        "/api/uploads/selfie",
        files={"file": ("selfie.jpg", jpeg_bytes(), "image/jpeg")},
    )
    assert upload.status_code == 201, upload.text

    with db_session_factory() as db:
        style_id = db.query(Style.id).order_by(Style.sort_order).first()[0]

    create = client.post(
        "/api/portraits",
        json={"style_id": style_id, "selfie_url": upload.json()["url"]},
    )

    assert create.status_code == 201, create.text
    assert "credits_used" not in create.json()


def test_deepseek_analysis_is_used_before_seedream(client, db_session_factory, monkeypatch):
    from app.routers import portraits

    register_user(client, db_session_factory, email="analysis@example.com")
    analyzed = {}

    def fake_analysis(user_prompt, style_name):
        analyzed.update(user_prompt=user_prompt, style_name=style_name)
        return "A cinematic portrait on a rainy city street, wearing a black coat."

    monkeypatch.setattr(portraits.prompt_analysis_service, "analyze", fake_analysis)
    response = client.post(
        "/api/portraits",
        json={"selfie_url": upload_selfie(client), "user_prompt": "雨夜街头，黑色风衣"},
    )

    assert response.status_code == 201, response.text
    assert analyzed == {"user_prompt": "雨夜街头，黑色风衣", "style_name": None}
    with db_session_factory() as db:
        task = db.query(PortraitTask).filter(PortraitTask.id == response.json()["id"]).one()
        assert portraits.SYSTEM_PORTRAIT_PROMPT in task.prompt_used
        assert "雨夜街头，黑色风衣" in task.prompt_used
        assert "A cinematic portrait on a rainy city street" in task.prompt_used


def test_portrait_rejects_another_users_selfie(client, db_session_factory):
    register_user(client, db_session_factory, email="owner@example.com")
    upload = client.post(
        "/api/uploads/selfie",
        files={"file": ("selfie.jpg", jpeg_bytes(), "image/jpeg")},
    )
    assert upload.status_code == 201

    client.post("/api/auth/logout")
    register_user(client, db_session_factory, email="attacker@example.com")
    with db_session_factory() as db:
        style_id = db.query(Style.id).order_by(Style.sort_order).first()[0]

    response = client.post(
        "/api/portraits",
        json={"style_id": style_id, "selfie_url": upload.json()["url"]},
    )

    assert response.status_code == 400


def test_orders_router_is_not_mounted(client):
    assert client.get("/api/orders/packages").status_code == 404


def test_generation_failure_hides_internal_error(client, db_session_factory, monkeypatch):
    from app.routers import portraits

    user_data = register_user(client, db_session_factory, email="failure-copy@example.com")
    with db_session_factory() as db:
        style = db.query(Style).order_by(Style.sort_order).first()
        task = PortraitTask(
            user_id=user_data["user"]["id"],
            style_id=style.id,
            selfie_url="/uploads/selfies/private/input.jpg",
            status="pending",
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        task_id = task.id

    monkeypatch.setattr(
        portraits.ai_service,
        "generate_portrait_sync",
        lambda *_: (_ for _ in ()).throw(
            ImportError("Using SOCKS proxy, but the 'socksio' package is not installed")
        ),
    )

    portraits._run_generation(task_id, "/tmp/input.jpg", None, "prompt")

    with db_session_factory() as db:
        task = db.query(PortraitTask).filter(PortraitTask.id == task_id).one()
        assert task.status == "failed"
        assert task.error_message == "生成服务暂时不可用，请稍后再试"
