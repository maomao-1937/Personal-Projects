"""混元大模型客户端。OpenAI 兼容接口。mock 模式下不初始化真实客户端(服务层自行短路)。"""
import base64
import json
import re

from openai import OpenAI

from app.core.config import settings
from app.core.errors import AppError
from app.core.logger import logger

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.hunyuan_api_key:
            raise AppError(
                "config_error",
                "HUNYUAN_API_KEY 未配置(且 MOCK_MODE=false)",
                500,
            )
        _client = OpenAI(
            api_key=settings.hunyuan_api_key,
            base_url=settings.hunyuan_base_url,
            timeout=180.0,
        )
    return _client


def complete_text(system: str, user: str, *, model: str | None = None) -> str:
    """文本补全。返回模型文本。"""
    if settings.mock_mode:
        raise AppError("config_error", "mock 模式不应走到真实 LLM 调用", 500)
    cli = _get_client()
    m = model or settings.hunyuan_model
    try:
        resp = cli.chat.completions.create(
            model=m,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:  # noqa: BLE001
        logger.warning("LLM text call failed: %s: %s", type(e).__name__, e)
        raise AppError("llm_error", f"模型调用失败: {type(e).__name__}", 502)


def complete_json(system: str, user: str, *, model: str | None = None) -> dict:
    """JSON 补全。强约束 + 宽松解析 + 有限重试。

    只对「解析失败」重试;调用失败(认证/网络/超时)直接抛真实错误,不再误报为解析失败。
    """
    if settings.mock_mode:
        raise AppError("config_error", "mock 模式不应走到真实 LLM 调用", 500)
    sys_prompt = system + "\n\n严格只输出一个 JSON 对象,不要 markdown 代码块,不要解释。"
    for attempt in range(settings.llm_max_retries + 1):
        # 第一步:调用失败(认证/网络等)直接透传,不重试、不误报
        text = complete_text(sys_prompt, user, model=model)
        # 第二步:只对解析失败重试
        try:
            return _parse_json_lenient(text)
        except AppError as e:
            logger.warning(
                "JSON 解析失败 attempt=%d: %s | 原始输出前200字: %.200s",
                attempt, e.message, text,
            )
    raise AppError(
        "llm_format_error",
        f"模型输出无法解析为 JSON(重试 {settings.llm_max_retries} 次仍失败)",
        502,
    )


def vision_complete_json(
    system: str,
    user: str,
    image_path: str,
    *,
    model: str | None = None,
) -> dict:
    """视觉模型:一张截图 + 文本 → JSON。一次性判定(不二次串接)。"""
    if settings.mock_mode:
        raise AppError("config_error", "mock 模式不应走到真实 LLM 调用", 500)
    from pathlib import Path

    p = Path(image_path)
    if not p.exists():
        raise AppError("evidence_missing", f"截图不存在: {image_path}", 500)
    b64 = base64.b64encode(p.read_bytes()).decode()
    ext = p.suffix.lstrip(".").lower() or "png"
    mime = "jpeg" if ext in ("jpg", "jpeg") else "png"

    cli = _get_client()
    m = model or settings.hunyuan_vision_model
    sys_prompt = system + "\n\n严格只输出一个 JSON 对象,不要 markdown 代码块,不要解释。"
    try:
        resp = cli.chat.completions.create(
            model=m,
            messages=[
                {"role": "system", "content": sys_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/{mime};base64,{b64}"
                            },
                        },
                    ],
                },
            ],
            temperature=0.2,
        )
        text = resp.choices[0].message.content or ""
        return _parse_json_lenient(text)
    except AppError:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning("Vision call failed: %s: %s", type(e).__name__, e)
        raise AppError("llm_error", f"视觉模型调用失败: {type(e).__name__}", 502)


def _parse_json_lenient(text: str) -> dict:
    """宽松解析:剥 markdown 代码块,容忍前后多余文本,取首个 {...},并修复常见小错误。"""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    start = t.find("{")
    end = t.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise AppError("parse_error", "响应中找不到 JSON 对象", 502)
    frag = t[start : end + 1]
    # 修复模型常见小错误:尾逗号 / 全角引号 / 中文冒号(键值分隔)
    frag = re.sub(r",\s*([}\]])", r"\1", frag)
    frag = frag.replace("，", ",").replace("：", ":")
    frag = re.sub(r"[“”]", '"', frag)
    try:
        return json.loads(frag)
    except json.JSONDecodeError as e:
        raise AppError("parse_error", f"JSON 解析失败: {e.msg}", 502)
