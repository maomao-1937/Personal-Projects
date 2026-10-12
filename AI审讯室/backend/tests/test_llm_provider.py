import json

import httpx
from pydantic import SecretStr

from app.core.config import Settings
from app.llm.provider import OpenAICompatibleProvider


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
        llm_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
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


def test_deepseek_uses_official_thinking_toggle() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"ok": true}'}}]},
        )

    settings = Settings(
        _env_file=None,
        llm_enabled=True,
        llm_api_key=SecretStr("test-key"),
        llm_base_url="https://api.deepseek.com",
        llm_case_model="deepseek-flash",
        llm_review_model="deepseek-flash",
        llm_dialogue_model="deepseek-flash",
    )
    provider = OpenAICompatibleProvider(
        settings,
        transport=httpx.MockTransport(handler),
    )

    assert provider.generate_case_json("生成案件") == '{"ok": true}'
    assert captured["thinking"] == {"type": "disabled"}
    assert "enable_thinking" not in captured


def test_case_intent_analysis_uses_bounded_json_request() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"scene":"测试"}'}}]},
        )

    settings = Settings(
        _env_file=None,
        llm_enabled=True,
        llm_api_key=SecretStr("test-key"),
        llm_base_url="https://api.deepseek.com",
        llm_case_model="deepseek-flash",
        llm_review_model="deepseek-flash",
        llm_dialogue_model="deepseek-flash",
        llm_timeout_seconds=60,
    )
    provider = OpenAICompatibleProvider(settings, transport=httpx.MockTransport(handler))

    assert provider.analyze_case_json("雨夜博物馆") == '{"scene":"测试"}'
    assert captured["response_format"] == {"type": "json_object"}
    assert captured["thinking"] == {"type": "disabled"}
    assert captured["max_tokens"] == 900
    assert "玩家想法" in captured["messages"][0]["content"]
