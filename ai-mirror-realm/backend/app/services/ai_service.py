import base64
import logging
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.api_key = settings.AI_API_KEY
        self.base_url = settings.AI_API_BASE_URL.rstrip("/")
        self.model = settings.AI_MODEL
        self.image_size = getattr(settings, "AI_IMAGE_SIZE", "2K")
        self.response_format = settings.AI_RESPONSE_FORMAT
        self.watermark = settings.AI_WATERMARK

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def is_tokenhub_hunyuan(self) -> bool:
        return "tokenhub.tencentmaas.com" in self.base_url or self.model == "hy-image-v3"

    @property
    def supports_template_reference(self) -> bool:
        return not self.is_tokenhub_hunyuan and self.model.startswith("doubao-seedream-")

    def _build_request(
        self,
        selfie_path: Path,
        prompt: str,
        negative_prompt: str,
        reference_path: Path | None = None,
        identity_paths: list[Path] | None = None,
    ):
        if self.is_tokenhub_hunyuan:
            image_base64 = base64.b64encode(selfie_path.read_bytes()).decode()
            size = self.image_size if "x" in self.image_size.lower() else "768x1280"
            return (
                f"{self.base_url}/v1/wand/hunyuan-image/v3-generation",
                {
                    "model": self.model,
                    "prompt": prompt,
                    "images": [image_base64],
                    "size": size,
                    "revise": True,
                },
            )

        image = self._encode_image(selfie_path)
        if self.supports_template_reference:
            identities = identity_paths or [selfie_path]
            if len(identities) > 9:
                raise ValueError("最多支持9张身份照片")
            references = [self._encode_image(Path(path)) for path in identities]
            if reference_path is not None:
                references.append(self._encode_image(Path(reference_path)))
            image = references if len(references) > 1 else references[0]

        payload = {
            "model": self.model,
            "prompt": prompt,
            "image": image,
            "size": self.image_size,
            "response_format": self.response_format,
            "sequential_image_generation": "disabled",
            "stream": False,
            "watermark": self.watermark,
        }
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
        return (
            f"{self.base_url}/api/v3/images/generations",
            payload,
        )

    async def generate_portrait(
        self,
        selfie_path: Path,
        prompt: str,
        negative_prompt: str = "",
        reference_path: Path | None = None,
        identity_paths: list[Path] | None = None,
    ) -> bytes:
        """异步生成写真（图生图）

        调用火山方舟 Seedream 模型的 OpenAI 兼容接口。
        """
        if not self.is_configured:
            raise RuntimeError("AI API Key 未配置")

        endpoint, payload = self._build_request(selfie_path, prompt, negative_prompt, reference_path, identity_paths)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    endpoint,
                    json=payload,
                    headers=headers,
                )

                if resp.status_code != 200:
                    error_text = resp.text
                    try:
                        error_data = resp.json()
                        error_msg = error_data.get("error", {}).get("message", error_text)
                    except Exception:
                        error_msg = error_text
                    logger.error(f"AI API 错误 {resp.status_code}: {error_msg}")
                    raise RuntimeError(f"AI 生图失败（{resp.status_code}）: {error_msg}")

                data = resp.json()

                if "data" in data and len(data["data"]) > 0:
                    item = data["data"][0]
                    if "b64_json" in item:
                        return base64.b64decode(item["b64_json"])
                    elif "url" in item:
                        img_resp = await client.get(item["url"])
                        img_resp.raise_for_status()
                        return img_resp.content

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
        reference_path: Path | None = None,
        identity_paths: list[Path] | None = None,
    ) -> bytes:
        """同步生成写真（图生图）—— 供 BackgroundTasks 使用

        调用火山方舟 Seedream 模型的 OpenAI 兼容接口。
        """
        path = Path(selfie_path) if not isinstance(selfie_path, Path) else selfie_path

        if not self.is_configured:
            raise RuntimeError("AI API Key 未配置")

        endpoint, payload = self._build_request(path, prompt, negative_prompt, reference_path, identity_paths)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(
                    endpoint,
                    json=payload,
                    headers=headers,
                )

                if resp.status_code != 200:
                    error_text = resp.text
                    try:
                        error_data = resp.json()
                        error_msg = error_data.get("error", {}).get("message", error_text)
                    except Exception:
                        error_msg = error_text
                    logger.error(f"AI API 错误 {resp.status_code}: {error_msg}")
                    raise RuntimeError(f"AI 生图失败（{resp.status_code}）: {error_msg}")

                data = resp.json()

                if "data" in data and len(data["data"]) > 0:
                    item = data["data"][0]
                    if "b64_json" in item:
                        return base64.b64decode(item["b64_json"])
                    elif "url" in item:
                        img_resp = client.get(item["url"])
                        img_resp.raise_for_status()
                        return img_resp.content

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
        """将图片编码为 data URL 格式（Seedream API 要求）"""
        ext = path.suffix.lower().lstrip(".")
        if ext == "jpg":
            ext = "jpeg"
        b64 = base64.b64encode(path.read_bytes()).decode()
        return f"data:image/{ext};base64,{b64}"


ai_service = AIService()
