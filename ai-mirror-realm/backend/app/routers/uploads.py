from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, status
from fastapi.responses import FileResponse

from app.config import settings
from app.models.user import User
from app.services.auth_service import get_current_invited_user
from app.services.file_service import save_upload
from app.utils.file_utils import resolve_media_path

router = APIRouter(prefix="/api/uploads", tags=["文件上传"])

# 允许的 MIME 类型
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


@router.get("/selfie")
def read_selfie(
    url: str = Query(..., min_length=1, max_length=500),
    current_user: User = Depends(get_current_invited_user),
):
    """读取当前账户已上传的自拍，供私有编辑草稿恢复预览。"""
    not_found = HTTPException(status_code=404, detail="自拍照不存在")
    if not url.startswith("/uploads/selfies/"):
        raise not_found
    selfie_path = resolve_media_path(url, must_exist=True)
    expected_dir = (settings.UPLOAD_DIR / "selfies" / current_user.id).resolve()
    if selfie_path is None:
        raise not_found
    try:
        selfie_path.relative_to(expected_dir)
    except ValueError:
        raise not_found

    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    media_type = media_types.get(selfie_path.suffix.lower())
    if media_type is None:
        raise not_found
    return FileResponse(
        path=selfie_path,
        media_type=media_type,
        headers={"Cache-Control": "private, no-store"},
    )


@router.post("/selfie", status_code=status.HTTP_201_CREATED)
async def upload_selfie(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_invited_user),
):
    """上传自拍照

    文件限制：
    - 最大 10MB
    - 仅支持 jpg/jpeg/png/webp 格式
    """
    # 校验 MIME 类型
    if not file.content_type or file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件类型 '{file.content_type}'，仅支持 {', '.join(sorted(settings.ALLOWED_EXTENSIONS))} 格式",
        )

    # 校验文件扩展名（双重校验，防止 MIME 类型伪造）
    if file.filename:
        ext = file.filename.split(".")[-1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件格式: .{ext}，请上传 {', '.join(sorted(settings.ALLOWED_EXTENSIONS))} 格式",
            )

    url = await save_upload(file, subdir=f"selfies/{current_user.id}")
    return {"url": url, "filename": file.filename}
