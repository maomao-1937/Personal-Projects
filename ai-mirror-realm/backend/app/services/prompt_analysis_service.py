"""Turn a user's creative brief into a concise image-generation direction."""

import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

ANALYSIS_INSTRUCTIONS = (
    "You are a portrait photography brief editor. Analyze the user's creative direction "
    "and rewrite it as one concise, concrete visual prompt for an image-to-image model. "
    "Preserve the user's intended scene, clothing, mood, and explicit constraints. "
    "Do not invent the person's identity, age, facial features, body type, or ethnicity. "
    "Do not add instructions about model behavior, API parameters, or safety policy. "
    "The reference photo and separate system requirements control the person's identity. "
    'Reply with JSON only: {"visual_prompt": "one or two English sentences"}. '
    "Keep visual_prompt under 600 characters."
)


class PromptAnalysisService:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.base_url = settings.DEEPSEEK_API_BASE_URL.rstrip("/")
        self.model = settings.DEEPSEEK_MODEL

    def analyze(self, user_prompt: str | None, style_name: str | None = None) -> str | None:
        """Use DeepSeek when configured; preserve the original brief on any failure.

        Only the text brief and optional theme name leave this service. The selfie,
        account identity, and private file paths are never sent to DeepSeek.
        """
        if not user_prompt:
            return None
        original = user_prompt.strip()
        if not original or not self.api_key:
            return original or None

        try:
            with httpx.Client(timeout=15) as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": ANALYSIS_INSTRUCTIONS},
                            {
                                "role": "user",
                                "content": json.dumps(
                                    {"theme": style_name, "creative_direction": original},
                                    ensure_ascii=False,
                                ),
                            },
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 400,
                        "stream": False,
                    },
                )
                response.raise_for_status()

            choice = response.json()["choices"][0]
            if choice.get("finish_reason") != "stop":
                raise ValueError("incomplete prompt analysis")
            parsed = json.loads(choice["message"]["content"])
            visual_prompt = parsed.get("visual_prompt")
            if not isinstance(visual_prompt, str):
                raise ValueError("missing visual_prompt")
            visual_prompt = visual_prompt.strip()
            if not visual_prompt or len(visual_prompt) > 1200:
                raise ValueError("invalid visual_prompt length")
            return visual_prompt
        except Exception as exc:
            logger.warning("DeepSeek prompt analysis unavailable: %s", type(exc).__name__)
            return original


prompt_analysis_service = PromptAnalysisService()
