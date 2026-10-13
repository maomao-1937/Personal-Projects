import base64

import pytest

from app.services.ai_service import AIService


def test_seedream_uses_identity_then_template_reference(tmp_path):
    selfie = tmp_path / "selfie.jpg"
    template = tmp_path / "template.png"
    selfie.write_bytes(b"identity-image")
    template.write_bytes(b"template-image")
    service = AIService()
    service.model = "doubao-seedream-4-5-251128"
    service.base_url = "https://ark.cn-beijing.volces.com"

    _, payload = service._build_request(selfie, "portrait", "", reference_path=template)

    assert payload["image"] == [
        "data:image/jpeg;base64," + base64.b64encode(b"identity-image").decode(),
        "data:image/png;base64," + base64.b64encode(b"template-image").decode(),
    ]
    assert payload["sequential_image_generation"] == "disabled"


def test_other_provider_ignores_optional_template_reference(tmp_path):
    selfie = tmp_path / "selfie.jpg"
    selfie.write_bytes(b"identity-image")
    service = AIService()
    service.model = "hy-image-v3"
    service.base_url = "https://tokenhub.tencentmaas.com"

    _, payload = service._build_request(
        selfie, "portrait", "", reference_path=tmp_path / "missing-template.jpg",
        identity_paths=[selfie, tmp_path / "missing-second-identity.jpg"],
    )

    assert payload["images"] == [base64.b64encode(b"identity-image").decode()]
    assert "image" not in payload


def test_seedream_orders_all_identity_images_before_template(tmp_path):
    identities = []
    for index in range(4):
        path = tmp_path / f"identity-{index}.jpg"
        path.write_bytes(f"person-{index}".encode())
        identities.append(path)
    template = tmp_path / "template.jpg"
    template.write_bytes(b"clothing-and-background")
    service = AIService()
    service.model = "doubao-seedream-4-5-251128"
    service.base_url = "https://ark.cn-beijing.volces.com"

    _, payload = service._build_request(identities[0], "portrait", "", reference_path=template, identity_paths=identities)

    expected = identities + [template]
    assert payload["image"] == [service._encode_image(path) for path in expected]
    assert len(payload["image"]) == 5


def test_seedream_accepts_nine_identities_plus_template_and_rejects_ten_identities(tmp_path):
    identities = []
    for index in range(10):
        path = tmp_path / f"identity-{index}.jpg"
        path.write_bytes(f"person-{index}".encode())
        identities.append(path)
    template = tmp_path / "template.jpg"
    template.write_bytes(b"template-scene")
    service = AIService()
    service.model = "doubao-seedream-4-5-251128"
    service.base_url = "https://ark.cn-beijing.volces.com"

    _, payload = service._build_request(
        identities[0], "portrait", "", reference_path=template, identity_paths=identities[:9],
    )
    assert len(payload["image"]) == 10
    assert payload["image"][-1] == service._encode_image(template)
    with pytest.raises(ValueError, match="9张"):
        service._build_request(identities[0], "portrait", "", reference_path=template, identity_paths=identities)


def test_seedream_uses_url_response_and_downloads_private_result(tmp_path, monkeypatch):
    image_path = tmp_path / "selfie.jpg"
    image_path.write_bytes(b"\xff\xd8\xfftest-image")
    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

        def json(self):
            return {"data": [{"url": "https://example.com/signed-result.png"}]}

    class FakeImageResponse:
        content = b"\x89PNG\r\n\x1a\nresult"

        def raise_for_status(self):
            pass

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def post(self, url, json, headers):
            captured.update(url=url, payload=json, headers=headers)
            return FakeResponse()

        def get(self, url):
            captured["download_url"] = url
            return FakeImageResponse()

    monkeypatch.setattr("app.services.ai_service.httpx.Client", lambda timeout: FakeClient())
    service = AIService()
    service.api_key = "test-key"
    service.base_url = "https://ark.cn-beijing.volces.com"
    service.model = "doubao-seedream-4-5-251128"
    service.image_size = "2K"
    service.response_format = "url"
    service.watermark = True

    assert service.generate_portrait_sync(image_path, "portrait") == b"\x89PNG\r\n\x1a\nresult"
    assert captured["url"] == "https://ark.cn-beijing.volces.com/api/v3/images/generations"
    assert captured["payload"]["model"] == "doubao-seedream-4-5-251128"
    assert captured["payload"]["image"].startswith("data:image/jpeg;base64,")
    assert captured["payload"]["response_format"] == "url"
    assert captured["payload"]["sequential_image_generation"] == "disabled"
    assert captured["payload"]["stream"] is False
    assert captured["payload"]["watermark"] is True
    assert "negative_prompt" not in captured["payload"]
    assert captured["download_url"] == "https://example.com/signed-result.png"


def test_tokenhub_uses_hunyuan_image_to_image_contract(tmp_path, monkeypatch):
    image_path = tmp_path / "selfie.jpg"
    image_path.write_bytes(b"selfie-bytes")
    captured = {}

    class FakeResponse:
        status_code = 200
        text = "ok"

        def json(self):
            return {"data": [{"b64_json": base64.b64encode(b"result").decode()}]}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def post(self, url, json, headers):
            captured.update(url=url, payload=json, headers=headers)
            return FakeResponse()

    monkeypatch.setattr("app.services.ai_service.httpx.Client", lambda timeout: FakeClient())
    service = AIService()
    service.api_key = "test-key"
    service.base_url = "https://tokenhub.tencentmaas.com"
    service.model = "hy-image-v3"
    service.image_size = "2K"

    assert service.generate_portrait_sync(image_path, "portrait") == b"result"
    assert captured["url"] == "https://tokenhub.tencentmaas.com/v1/wand/hunyuan-image/v3-generation"
    assert captured["payload"]["images"] == [base64.b64encode(b"selfie-bytes").decode()]
    assert captured["payload"]["size"] == "768x1280"
    assert captured["payload"]["revise"] is True
    assert "image" not in captured["payload"]
