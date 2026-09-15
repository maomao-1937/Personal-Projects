from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.portrait import PortraitTask
from app.models.user import User
from app.services.auth_service import get_current_invited_user
from app.utils.file_utils import resolve_media_path

router = APIRouter(prefix="/api/media", tags=["私密媒体"])


def _private_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="写真不存在")


@router.get("/portraits/{portrait_id}")
def get_portrait_media(
    portrait_id: str,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    portrait = (
        db.query(PortraitTask)
        .filter(
            PortraitTask.id == portrait_id,
            PortraitTask.user_id == current_user.id,
        )
        .first()
    )
    if not portrait or portrait.status != "completed" or not portrait.result_url:
        raise _private_not_found()

    media_path = resolve_media_path(portrait.result_url, must_exist=True)
    if media_path is None:
        raise _private_not_found()
    try:
        media_path.relative_to(settings.GENERATED_DIR.resolve())
    except ValueError:
        raise _private_not_found()

    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    return FileResponse(
        path=media_path,
        media_type=media_types.get(media_path.suffix.lower(), "application/octet-stream"),
        headers={"Cache-Control": "private, no-store"},
    )
