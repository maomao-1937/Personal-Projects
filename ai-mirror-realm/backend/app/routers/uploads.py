from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.file_service import save_upload

router = APIRouter(prefix="/api/uploads", tags=["文件上传"])

# 允许的 MIME 类型
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


@router.post("/selfie", status_code=status.HTTP_201_CREATED)
async def upload_selfie(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
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
