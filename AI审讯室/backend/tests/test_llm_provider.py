import json

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.llm.provider import LLMProviderError, OpenAICompatibleProvider


def test_case_generation_embeds_machine_schema_in_json_object_prompt() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": '{"ok": true}'}}
                ],
                "usage": {"total_tokens": 1},
            },
        )

    settings = Settings(
        _env_file=None,
        llm_enabled=True,
        llm_api_key=SecretStr("test-key"),
        llm_case_model="qwen3.6-plus",
        llm_review_model="qwen3.6-plus",
        llm_dialogue_model="qwen-plus-character",
    )
    provider = OpenAICompatibleProvider(
        settings,
        transport=httpx.MockTransport(handler),
    )

    assert provider.generate_case_json("生成案件") == '{"ok": true}'
    assert captured["response_format"] == {"type": "json_object"}
    assert captured["enable_thinking"] is False
    prompt = captured["messages"][1]["content"]
    assert '"evidence"' in prompt
    assert '"lieNodes"' in prompt
    assert '"replyTemplates"' in prompt
    assert "不要改字段名" in prompt


@pytest.mark.parametrize(
    "method,response_text",
    [
        ("generate_case_json", '{"ok": true}'),
        ("review_case_json", '{"passed": true, "issues": []}'),
        ("generate_reply", "我一直在档案室处理索引，没有离开。"),
    ],
)
def test_deepseek_uses_non_thinking_mode(method: str, response_text: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert request.url == "https://api.deepseek.com/chat/completions"
        assert payload["thinking"] == {"type": "disabled"}
        assert "enable_thinking" not in payload
        return httpx.Response(
            200, json={"choices": [{"message": {"content": response_text}}]}
        )

    provider = OpenAICompatibleProvider(
        Settings(
            _env_file=None,
            llm_enabled=True,
            llm_api_key=SecretStr("test-key"),
            llm_base_url="https://api.deepseek.com",
            llm_case_model="deepseek-flash",
            llm_review_model="deepseek-flash",
            llm_dialogue_model="deepseek-flash",
        ),
        transport=httpx.MockTransport(handler),
    )

    assert getattr(provider, method)("验证接口兼容性") == response_text


def test_intent_analysis_is_a_short_json_call_with_product_constraints() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert body["response_format"] == {"type": "json_object"}
        assert body["max_tokens"] <= 1000
        assert body["temperature"] <= 0.2
        assert request.extensions["timeout"]["read"] <= 30
        assert "目标玩家" in body["messages"][0]["content"]
        assert "JSON" in body["messages"][0]["content"]
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"ok":true}'}}]})

    provider = OpenAICompatibleProvider(
        Settings(_env_file=None, llm_api_key=SecretStr("test-key")),
        transport=httpx.MockTransport(handler),
    )
    assert provider.analyze_case_json("只是一条玩家想法") == '{"ok":true}'


def test_empty_upstream_choices_is_a_recoverable_provider_failure() -> None:
    provider = OpenAICompatibleProvider(
        Settings(_env_file=None, llm_api_key=SecretStr("test-key")),
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"choices": []})
        ),
    )
    with pytest.raises(LLMProviderError):
        provider.analyze_case_json("博物馆案件")
