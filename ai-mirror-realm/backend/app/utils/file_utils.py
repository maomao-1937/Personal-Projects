from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.config import settings


def resolve_media_path(url_path: str, must_exist: bool = False) -> Path | None:
    if not url_path:
        return None

    cleaned = url_path.lstrip("/")

    if ".." in cleaned or cleaned.startswith("."):
        return None

    if "\x00" in cleaned:
        return None

    base = settings.UPLOAD_DIR.parent
    full = (base / cleaned).resolve()

    try:
        full.relative_to(base.resolve())
    except ValueError:
        return None

    if must_exist and not full.is_file():
        return None

    return full
