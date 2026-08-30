import base64
import logging
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.api_key = settings.AI_API_KEY
        self.base_url = settings.AI_API_BASE_URL
        self.model = settings.AI_MODEL
        self.image_size = "768x1280"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate_portrait(
        self,
        selfie_path: Path,
        prompt: str,
        negative_prompt: str = "",
    ) -> bytes:
        if not self.is_configured:
            raise RuntimeError("AI API Key 未配置")

        image_base64 = self._encode_image(selfie_path)

        payload = {
            "model": self.model,
            "prompt": prompt,
            "images": [image_base64],
            "size": self.image_size,
            "revise": True,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{self.base_url}/v1/wand/hunyuan-image/v3-generation",
                    json=payload,
                    headers=headers,
                )

                if resp.status_code != 200:
                    error_text = resp.text
                    try:
                        error_data = resp.json()
                        error_msg = error_data.get("error", {}).get("message_zh", error_text)
                    except Exception:
                        error_msg = error_text
                    logger.error(f"AI API 错误 {resp.status_code}: {error_msg}")
                    raise RuntimeError(f"AI 生图失败（{resp.status_code}）: {error_msg}")

                data = resp.json()

                if "data" in data and len(data["data"]) > 0:
                    item = data["data"][0]
                    if "url" in item:
                        img_resp = await client.get(item["url"])
                        img_resp.raise_for_status()
                        return img_resp.content
                    elif "b64_json" in item:
                        return base64.b64decode(item["b64_json"])

                raise ValueError(f"AI API 返回数据格式异常: {data}")

        except RuntimeError:
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"AI API HTTP 错误: {e.response.status_code} - {e.response.text}")
            raise RuntimeError(f"AI 服务请求失败: {e.response.status_code}")
        except Exception as e:
            logger.error(f"AI 生成异常: {type(e).__name__}: {e}")
            raise

    def generate_portrait_sync(
        self,
        selfie_path,
        prompt: str,
        negative_prompt: str = "",
    ) -> bytes:
        path = Path(selfie_path) if not isinstance(selfie_path, Path) else selfie_path

        if not self.is_configured:
            raise RuntimeError("AI API Key 未配置")

        image_base64 = self._encode_image(path)

        payload = {
            "model": self.model,
            "prompt": prompt,
            "images": [image_base64],
            "size": self.image_size,
            "revise": True,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(
                    f"{self.base_url}/v1/wand/hunyuan-image/v3-generation",
                    json=payload,
                    headers=headers,
                )

                if resp.status_code != 200:
                    error_text = resp.text
                    try:
                        error_data = resp.json()
                        error_msg = error_data.get("error", {}).get("message_zh", error_text)
                    except Exception:
                        error_msg = error_text
                    logger.error(f"AI API 错误 {resp.status_code}: {error_msg}")
                    raise RuntimeError(f"AI 生图失败（{resp.status_code}）: {error_msg}")

                data = resp.json()

                if "data" in data and len(data["data"]) > 0:
                    item = data["data"][0]
                    if "url" in item:
                        img_resp = client.get(item["url"])
                        img_resp.raise_for_status()
                        return img_resp.content
                    elif "b64_json" in item:
                        return base64.b64decode(item["b64_json"])

                raise ValueError(f"AI API 返回数据格式异常: {data}")

        except RuntimeError:
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"AI API HTTP 错误: {e.response.status_code} - {e.response.text}")
            raise RuntimeError(f"AI 服务请求失败: {e.response.status_code}")
        except Exception as e:
            logger.error(f"AI 生成异常: {type(e).__name__}: {e}")
            raise

    def _encode_image(self, path: Path) -> str:
        return base64.b64encode(path.read_bytes()).decode()


ai_service = AIService()
