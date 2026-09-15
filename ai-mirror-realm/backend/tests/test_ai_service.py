import base64

from app.services.ai_service import AIService


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
