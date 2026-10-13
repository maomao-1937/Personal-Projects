import uuid
from pathlib import Path

from fastapi import UploadFile, HTTPException, status

from app.config import settings


async def save_upload(file: UploadFile, subdir: str = "") -> str:
    ext = file.filename.split(".")[-1].lower() if file.filename else "jpg"
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件格式: .{ext}，请上传 {', '.join(settings.ALLOWED_EXTENSIONS)} 格式",
        )

    # Read at most one byte over the limit so oversized uploads cannot occupy
    # unbounded application memory before the size check runs.
    content = await file.read(settings.MAX_FILE_SIZE + 1)
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件大小超过限制 ({settings.MAX_FILE_SIZE // 1024 // 1024}MB)",
        )

    signatures = {
        "jpg": content.startswith(b"\xff\xd8\xff"),
        "jpeg": content.startswith(b"\xff\xd8\xff"),
        "png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }
    if not signatures[ext]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件内容与图片格式不一致，请重新选择 JPG、PNG 或 WebP 图片",
        )

    filename = f"{uuid.uuid4().hex}.{ext}"
    save_dir = settings.UPLOAD_DIR / subdir if subdir else settings.UPLOAD_DIR
    save_dir.mkdir(parents=True, exist_ok=True)
    file_path = save_dir / filename
    file_path.write_bytes(content)

    return f"/uploads/{subdir}/{filename}" if subdir else f"/uploads/{filename}"


def save_generated_image(data: bytes, ext: str | None = None) -> str:
    """保存生成的图片，自动检测格式

    Args:
        data: 图片字节数据
        ext: 可选，指定文件扩展名。不传则自动检测。

    Returns:
        图片访问 URL 路径
    """
    if data.startswith(b'\xff\xd8\xff'):
        detected_ext = "jpg"
    elif data.startswith(b'\x89PNG\r\n\x1a\n'):
        detected_ext = "png"
    elif data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        detected_ext = "webp"
    else:
        raise ValueError("生图服务未返回受支持的图片内容")

    requested_ext = ext.lower().lstrip(".") if ext is not None else detected_ext
    if requested_ext == "jpeg":
        requested_ext = "jpg"
    if requested_ext != detected_ext:
        raise ValueError("生图结果格式与指定扩展名不一致")

    filename = f"{uuid.uuid4().hex}.{detected_ext}"
    file_path = settings.GENERATED_DIR / filename
    file_path.write_bytes(data)
    return f"/generated/{filename}"
