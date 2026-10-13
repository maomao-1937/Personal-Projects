from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.profile import FaceProfile
from app.models.user import User
from app.schemas.profile import ProfileCreate, ProfileOut, ProfileUpdate
from app.services.auth_service import get_current_invited_user
from app.utils.file_utils import resolve_media_path

router = APIRouter(prefix="/api/profiles", tags=["私有自拍档案"])


def _owned_profile(db: Session, profile_id: str, user_id: str) -> FaceProfile:
    profile = db.query(FaceProfile).filter(FaceProfile.id == profile_id, FaceProfile.user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="自拍档案不存在")
    return profile


def _validate_selfie(selfie_url: str, user_id: str) -> None:
    invalid = HTTPException(status_code=400, detail="自拍照文件不存在，请重新上传")
    if not selfie_url.startswith("/uploads/selfies/"):
        raise invalid
    selfie_path = resolve_media_path(selfie_url, must_exist=True)
    if selfie_path is None or selfie_path.suffix.lower().lstrip(".") not in settings.ALLOWED_EXTENSIONS:
        raise invalid
    try:
        selfie_path.relative_to((settings.UPLOAD_DIR / "selfies" / user_id).resolve())
    except ValueError:
        raise invalid


@router.get("", response_model=list[ProfileOut])
def list_profiles(
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    return db.query(FaceProfile).filter(FaceProfile.user_id == current_user.id).order_by(FaceProfile.created_at.desc()).all()


@router.post("", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: ProfileCreate,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    for selfie_url in payload.selfie_urls:
        _validate_selfie(selfie_url, current_user.id)
    profile = FaceProfile(user_id=current_user.id, name=payload.name, selfie_url=payload.selfie_url, selfie_urls=payload.selfie_urls)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.patch("/{profile_id}", response_model=ProfileOut)
def rename_profile(
    profile_id: str,
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    profile = _owned_profile(db, profile_id, current_user.id)
    profile.name = payload.name
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile_id: str,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    profile = _owned_profile(db, profile_id, current_user.id)
    db.delete(profile)
    db.commit()
