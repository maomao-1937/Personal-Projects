import json

from app.services.prompt_analysis_service import PromptAnalysisService


def test_without_key_preserves_original_prompt(monkeypatch):
    service = PromptAnalysisService()
    service.api_key = ""

    def must_not_call(*_args, **_kwargs):
        raise AssertionError("DeepSeek must not be called without a key")

    monkeypatch.setattr("app.services.prompt_analysis_service.httpx.Client", must_not_call)
    assert service.analyze("  雨夜街头  ") == "雨夜街头"
    assert service.analyze(None) is None


def test_deepseek_receives_only_text_and_returns_visual_prompt(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [{
                    "finish_reason": "stop",
                    "message": {"content": json.dumps({"visual_prompt": "Rainy city street portrait."})},
                }]
            }

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def post(self, url, *, headers, json):
            captured.update(url=url, headers=headers, payload=json)
            return FakeResponse()

    monkeypatch.setattr("app.services.prompt_analysis_service.httpx.Client", lambda timeout: FakeClient())
    service = PromptAnalysisService()
    service.api_key = "test-key"
    service.base_url = "https://api.deepseek.com"
    service.model = "deepseek-flash"

    assert service.analyze("雨夜街头", "复古") == "Rainy city street portrait."
    assert captured["url"] == "https://api.deepseek.com/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["payload"]["response_format"] == {"type": "json_object"}
    assert json.loads(captured["payload"]["messages"][1]["content"]) == {
        "theme": "复古", "creative_direction": "雨夜街头"
    }


def test_bad_response_falls_back_to_original(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def post(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr("app.services.prompt_analysis_service.httpx.Client", lambda timeout: FakeClient())
    service = PromptAnalysisService()
    service.api_key = "test-key"
    assert service.analyze("原始创意") == "原始创意"
