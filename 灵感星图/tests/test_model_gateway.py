import json
from types import SimpleNamespace

import httpx
import pytest

from app.config import get_settings
from app.domain import IncubationRequest
from app.main import _default_gateway
from app.model_gateway import (
    AnthropicModelGateway,
    ModelGatewayAuthenticationError,
    TencentHy3ModelGateway,
)


def test_server_key_selects_built_in_model_gateway(monkeypatch) -> None:
    monkeypatch.setenv("TENCENT_HY3_API_KEY", "server-managed-key")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    for proxy_name in ("ALL_PROXY", "HTTP_PROXY", "HTTPS_PROXY"):
        monkeypatch.delenv(proxy_name, raising=False)
    get_settings.cache_clear()
    try:
        gateway = _default_gateway()
        assert isinstance(gateway, TencentHy3ModelGateway)
    finally:
        get_settings.cache_clear()


def test_anthropic_gateway_repairs_invalid_structured_output_once() -> None:
    valid = {
        "summary": "Saved content",
        "organized_text": "Saved content",
        "material_type": "insight",
        "actors": [],
        "problems": [],
        "mechanisms": [],
        "insights": ["Saved content"],
        "topics": ["product"],
    }

    class FakeMessages:
        def __init__(self) -> None:
            self.calls = 0

        def create(self, **_kwargs):
            self.calls += 1
            text = "{}" if self.calls == 1 else json.dumps(valid)
            return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])

    messages = FakeMessages()
    gateway = AnthropicModelGateway(
        "test-key",
        "test-model",
        client=SimpleNamespace(messages=messages),
    )

    result = gateway.analyze_material("Saved content")

    assert result.summary == "Saved content"
    assert messages.calls == 2


def test_hy3_gateway_uses_fixed_tokenhub_model_and_parses_analysis() -> None:
    valid = {
        "summary": "家庭露营需要清晰分工",
        "organized_text": "为家庭露营建立按角色分工的准备清单，并用打卡确认完成情况。",
        "material_type": "mechanism",
        "actors": ["家庭露营用户"],
        "problems": [],
        "mechanisms": ["按家庭角色分工"],
        "insights": [],
        "topics": ["家庭露营", "角色分工"],
    }

    class FakeCompletions:
        def __init__(self) -> None:
            self.calls: list[dict] = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(message=SimpleNamespace(content=json.dumps(valid)))
                ]
            )

    completions = FakeCompletions()
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    gateway = TencentHy3ModelGateway("test-key", client=client)

    result = gateway.analyze_material("家庭可以根据角色分工完成露营准备")

    assert result.mechanisms == ["按家庭角色分工"]
    assert (
        result.organized_text
        == "为家庭露营建立按角色分工的准备清单，并用打卡确认完成情况。"
    )
    assert completions.calls[0]["model"] == "hy3"
    assert completions.calls[0]["stream"] is False
    assert "untrusted data" in completions.calls[0]["messages"][0]["content"]


def test_hy3_hypothesis_prompt_marks_selected_material_as_anchor(
    material_factory,
) -> None:
    seed = material_factory(summary="家庭露营装备容易遗漏")
    related = material_factory(summary="家庭成员可以按角色分工")
    valid = {
        "status": "ready",
        "title": "家庭露营分工清单",
        "one_liner": "让家庭按角色完成露营准备。",
        "target_user": "家庭露营用户",
        "problem": "装备容易遗漏",
        "source_contributions": [
            {
                "material_id": str(seed.id),
                "role": "problem",
                "contribution": "提供核心问题",
            },
            {
                "material_id": str(related.id),
                "role": "mechanism",
                "contribution": "提供分工机制",
            },
        ],
        "relationship_explanation": "用角色分工解决准备遗漏。",
        "mvp_scope": ["角色清单"],
        "first_validation_action": "邀请一个家庭试用",
        "time_estimate": "2 天",
    }

    class FakeCompletions:
        def __init__(self) -> None:
            self.calls: list[dict] = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(message=SimpleNamespace(content=json.dumps(valid)))
                ]
            )

    completions = FakeCompletions()
    gateway = TencentHy3ModelGateway(
        "test-key",
        client=SimpleNamespace(chat=SimpleNamespace(completions=completions)),
    )

    gateway.generate_hypothesis(
        [seed, related],
        IncubationRequest(seed_material_id=seed.id),
    )

    prompt = completions.calls[0]["messages"][1]["content"]
    assert "primary anchor" in prompt
    assert str(seed.id) in prompt


def test_hy3_gateway_tests_connection_through_chat_completion() -> None:
    class FakeCompletions:
        def __init__(self) -> None:
            self.calls: list[dict] = []

        def create(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="OK"))]
            )

    completions = FakeCompletions()
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    gateway = TencentHy3ModelGateway("test-key", client=client)

    gateway.test_connection()

    assert completions.calls == [
        {
            "model": "hy3",
            "messages": [{"role": "user", "content": "Reply with OK."}],
            "max_tokens": 8,
            "stream": False,
            "temperature": 0,
        }
    ]


def test_hy3_gateway_maps_authentication_failure() -> None:
    request = httpx.Request(
        "POST", "https://tokenhub.tencentmaas.com/v1/chat/completions"
    )
    response = httpx.Response(401, request=request)

    class FakeCompletions:
        def create(self, **_kwargs):
            raise httpx.HTTPStatusError(
                "invalid key",
                request=request,
                response=response,
            )

    client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    gateway = TencentHy3ModelGateway("bad-key", client=client)

    with pytest.raises(ModelGatewayAuthenticationError):
        gateway.analyze_material("saved idea")
