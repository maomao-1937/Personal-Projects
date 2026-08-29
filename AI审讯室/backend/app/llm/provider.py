from __future__ import annotations

import json
from typing import Protocol

import httpx

from app.core.config import Settings
from app.domain.case_models import CaseSnapshot
from app.llm.prompts import dialogue_messages, generation_messages, review_messages


class LLMProviderError(RuntimeError):
    pass


class LLMProvider(Protocol):
    configured: bool
    case_model: str

    def generate_case_json(self, prompt: str) -> str: ...

    def review_case_json(self, prompt: str) -> str: ...

    def generate_reply(self, prompt: str) -> str: ...


class UnavailableLLMProvider:
    configured = False
    case_model = ""

    def _raise(self) -> str:
        raise LLMProviderError("LLM provider is not configured")

    def generate_case_json(self, prompt: str) -> str:
        return self._raise()

    def review_case_json(self, prompt: str) -> str:
        return self._raise()

    def generate_reply(self, prompt: str) -> str:
        return self._raise()


class OpenAICompatibleProvider:
    configured = True

    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = settings.llm_base_url.rstrip("/")
        self.api_key = settings.llm_api_key.get_secret_value()
        self.case_model = settings.llm_case_model
        self.review_model = settings.llm_review_model
        self.dialogue_model = settings.llm_dialogue_model
        self.timeout_seconds = settings.llm_timeout_seconds
        self.trust_env = settings.llm_trust_env
        self.transport = transport

    @classmethod
    def from_settings(cls, settings: Settings) -> LLMProvider:
        if not settings.llm_configured:
            return UnavailableLLMProvider()
        return cls(settings)

    def generate_case_json(self, prompt: str) -> str:
        machine_schema = json.dumps(
            CaseSnapshot.model_json_schema(by_alias=True),
            ensure_ascii=False,
        )
        constrained_prompt = (
            f"{prompt}\n\n必须逐字段遵循以下 JSON Schema；"
            "不要改字段名，不要把字符串改成对象：\n"
            f"{machine_schema}"
        )
        return self._complete(
            model=self.case_model,
            messages=generation_messages(constrained_prompt),
            max_tokens=5000,
            temperature=0.6,
            response_format={"type": "json_object"},
            disable_thinking=True,
        )

    def review_case_json(self, prompt: str) -> str:
        return self._complete(
            model=self.review_model,
            messages=review_messages(prompt),
            max_tokens=1000,
            temperature=0,
            response_format={"type": "json_object"},
            disable_thinking=True,
        )

    def generate_reply(self, prompt: str) -> str:
        return self._complete(
            model=self.dialogue_model,
            messages=dialogue_messages(prompt),
            max_tokens=240,
            temperature=0.55,
            response_format=None,
            disable_thinking=False,
        )

    def _complete(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        max_tokens: int,
        temperature: float,
        response_format: dict | None,
        disable_thinking: bool,
    ) -> str:
        payload: dict = {
            "model": model,
            "messages": messages,
            "stream": False,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format is not None:
            payload["response_format"] = response_format
        if disable_thinking:
            payload["enable_thinking"] = False
        try:
            with httpx.Client(
                timeout=self.timeout_seconds,
                trust_env=self.trust_env,
                transport=self.transport,
            ) as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            response.raise_for_status()
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise LLMProviderError("model returned empty content")
            return content.strip()
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            raise LLMProviderError("model request failed") from exc
