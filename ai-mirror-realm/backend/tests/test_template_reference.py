from __future__ import annotations

from pathlib import Path

import pytest

from app.models.portrait import PortraitTask
from app.models.style import Style
from conftest import register_user


def upload(client) -> str:
    response = client.post(
        "/api/uploads/selfie",
        files={"file": ("selfie.jpg", b"\xff\xd8\xffidentity", "image/jpeg")},
    )
    assert response.status_code == 201
    return response.json()["url"]


def setup_template(db_session_factory, preview_url: str) -> str:
    with db_session_factory() as db:
        style = db.query(Style).order_by(Style.sort_order).first()
        style.preview_url = preview_url
        style.prompt_template = "Use the clothes and scenery from the template."
        db.commit()
        return style.id


def test_selected_template_is_forwarded_as_local_second_reference(client, db_session_factory, monkeypatch, tmp_path):
    from app.routers import portraits

    register_user(client, db_session_factory, email="template-reference@example.com")
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    template = template_dir / "0123456789abcdef.jpg"
    template.write_bytes(b"\xff\xd8\xfftemplate")
    monkeypatch.setattr(portraits, "MEITU_TEMPLATE_DIR", template_dir)
    monkeypatch.setattr(portraits.ai_service, "model", "doubao-seedream-4-5-251128")
    monkeypatch.setattr(portraits.ai_service, "base_url", "https://ark.cn-beijing.volces.com")
    monkeypatch.setattr(portraits.prompt_analysis_service, "analyze", lambda *_: None)
    captured = {}

    def generate(selfie_path, prompt, negative_prompt="", reference_path=None):
        captured.update(selfie=selfie_path, prompt=prompt, reference=reference_path)
        return b"\x89PNG\r\n\x1a\nresult"

    monkeypatch.setattr(portraits.ai_service, "generate_portrait_sync", generate)
    style_id = setup_template(db_session_factory, "/meitu-templates/0123456789abcdef.jpg")
    response = client.post("/api/portraits", json={"selfie_url": upload(client), "style_id": style_id})

    assert response.status_code == 201, response.text
    assert Path(captured["reference"]) == template.resolve()
    assert "first image" in captured["prompt"]
    assert "second image" in captured["prompt"]
    assert "Do not copy the second image's face" in captured["prompt"]
    with db_session_factory() as db:
        assert db.query(PortraitTask).filter_by(id=response.json()["id"]).one().status == "completed"


@pytest.mark.parametrize("invalid_url", [
    "/meitu-templates/../outside.jpg",
    "/meitu-templates/missing.jpg",
    "/meitu-templates/0123456789abcdef.jpg",
])
def test_template_reference_never_reads_outside_fixed_directory(client, db_session_factory, monkeypatch, tmp_path, invalid_url):
    from app.routers import portraits

    register_user(client, db_session_factory, email="invalid-template@example.com")
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    outside = tmp_path / "outside.jpg"
    outside.write_bytes(b"\xff\xd8\xffoutside")
    (template_dir / "0123456789abcdef.jpg").symlink_to(outside)
    monkeypatch.setattr(portraits, "MEITU_TEMPLATE_DIR", template_dir)
    monkeypatch.setattr(portraits.ai_service, "model", "doubao-seedream-4-5-251128")
    monkeypatch.setattr(portraits.ai_service, "base_url", "https://ark.cn-beijing.volces.com")
    style_id = setup_template(db_session_factory, invalid_url)

    response = client.post("/api/portraits", json={"selfie_url": upload(client), "style_id": style_id})

    assert response.status_code == 400
    with db_session_factory() as db:
        assert db.query(PortraitTask).count() == 0
