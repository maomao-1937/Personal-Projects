"""Prompt 模板加载。模板存 services/prompts/*.md,版本由 Git 追踪。"""
from pathlib import Path

from app.core.errors import AppError

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

_cache: dict[str, str] = {}


def load_prompt(name: str) -> str:
    """按名加载,内存缓存。"""
    if name in _cache:
        return _cache[name]
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise AppError("prompt_missing", f"Prompt 模板不存在: {name}", 500)
    text = path.read_text(encoding="utf-8")
    _cache[name] = text
    return text
