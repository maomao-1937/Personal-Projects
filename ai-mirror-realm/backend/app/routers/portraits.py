import logging
import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, SessionLocal
from app.models.portrait import PortraitTask
from app.models.profile import FaceProfile
from app.models.style import Style
from app.models.user import User
from app.schemas.portrait import PortraitCreate, PortraitOut, PortraitStatus
from app.services.ai_service import ai_service
from app.services.prompt_analysis_service import prompt_analysis_service
from app.services.auth_service import get_current_invited_user
from app.utils.file_utils import resolve_media_path
from app.utils.rate_limiter import limiter, get_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portraits", tags=["AI 写真"])
PUBLIC_GENERATION_ERROR = "生成服务暂时不可用，请稍后再试"
CUSTOM_STYLE_ID = "system-custom-prompt"
MEITU_TEMPLATE_DIR = Path(__file__).resolve().parents[3] / "frontend" / "public" / "meitu-templates"
TEMPLATE_REFERENCE_PROMPT = (
    "Use the first image as the only source of the person's facial identity and age. "
    "Use the second image only as a visual reference for clothing, makeup, hairstyle, "
    "scene, lighting, pose, and composition. Do not copy the second image's face "
    "or change the first person's recognizable identity. Produce one coherent portrait."
)
SYSTEM_PORTRAIT_PROMPT = (
    "Create one polished, photorealistic portrait from the provided reference photo. "
    "Preserve the same person's facial identity, recognizable features, age, and natural skin texture. "
    "Keep anatomy, hands, lighting, perspective, and composition coherent. "
    "Do not add text, logos, watermarks, sexual content, graphic violence, or illegal content."
)


def _build_generation_prompt(
    style_prompt: str | None,
    user_prompt: str | None,
    analyzed_prompt: str | None = None,
    has_template_reference: bool = False,
    identity_count: int = 1,
) -> str:
    parts = [f"Non-negotiable system requirements: {SYSTEM_PORTRAIT_PROMPT}"]
    if identity_count > 1:
        roles = (
            f"Use the first {identity_count} images as identity references of the same single person. "
            "Preserve that person's recognizable face, age, and identity across these photos. "
        )
        if has_template_reference:
            roles += (
                "Use the last image only for clothing, makeup, hairstyle, background, lighting, pose, and composition. "
                "Do not copy the last image's face or identity. "
            )
        roles += "Create one portrait of this person."
        parts.append(f"Non-negotiable image reference roles: {roles}")
    elif has_template_reference:
        parts.append(f"Non-negotiable image reference roles: {TEMPLATE_REFERENCE_PROMPT}")
    if style_prompt:
        parts.append(f"Selected visual direction: {style_prompt}")
    if user_prompt:
        parts.append(f"User creative direction: {user_prompt}")
    if analyzed_prompt and analyzed_prompt != user_prompt:
        parts.append(f"DeepSeek visual interpretation: {analyzed_prompt}")
    parts.append(
        "The system requirements above take priority over all creative directions. "
        "The user's original creative direction takes priority over its interpretation."
    )
    return "\n\n".join(parts)


def _resolve_template_reference(preview_url: str | None) -> Path | None:
    if not preview_url or not preview_url.startswith("/meitu-templates/"):
        return None
    match = re.fullmatch(r"/meitu-templates/([a-f0-9]{8,64}\.(?:jpg|jpeg|png|webp))", preview_url)
    unavailable = HTTPException(status_code=400, detail="模板参考图暂时不可用，请重新选择写真模板")
    if not match:
        raise unavailable
    reference_path = (MEITU_TEMPLATE_DIR / match.group(1)).resolve()
    try:
        reference_path.relative_to(MEITU_TEMPLATE_DIR.resolve())
    except ValueError:
        raise unavailable
    if not reference_path.is_file():
        raise unavailable
    return reference_path


def _get_or_create_custom_style(db: Session) -> Style:
    style = db.query(Style).filter(Style.id == CUSTOM_STYLE_ID).first()
    if style:
        return style
    style = Style(
        id=CUSTOM_STYLE_ID,
        name="自定义创作",
        category="自定义",
        description="使用用户描述创作的写真",
        prompt_template="Custom portrait direction supplied by the user.",
        preview_url=None,
        sort_order=9999,
        is_active=False,
    )
    db.add(style)
    db.flush()
    return style


def _private_result_url(task: PortraitTask) -> str | None:
    if not task.result_url:
        return None
    return f"/api/media/portraits/{task.id}"


def _portrait_out(task: PortraitTask) -> PortraitOut:
    result = PortraitOut.model_validate(task)
    result.style_name = task.style.name if task.style else None
    result.result_url = _private_result_url(task)
    return result


@router.post("", response_model=PortraitOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute", key_func=get_user_id)
def create_portrait(
    request: Request,
    payload: PortraitCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    """创建 AI 写真任务

    速率限制：同一用户每分钟最多 2 次
    """
    if payload.style_id:
        style = db.query(Style).filter(Style.id == payload.style_id).first()
        if not style or not style.is_active:
            raise HTTPException(status_code=404, detail="风格不存在或已下架")
        style_prompt = style.prompt_template
    else:
        style = _get_or_create_custom_style(db)
        style_prompt = None

    reference_path = _resolve_template_reference(style.preview_url) if payload.style_id and ai_service.supports_template_reference else None
    selfie_urls = payload.selfie_urls or [payload.selfie_url]
    identity_count = len(selfie_urls) if ai_service.supports_template_reference else 1
    generation_prompt = _build_generation_prompt(
        style_prompt, payload.user_prompt, has_template_reference=reference_path is not None,
        identity_count=identity_count,
    )

    selfie_paths = [resolve_media_path(url, must_exist=True) for url in selfie_urls]
    expected_selfie_dir = (
        settings.UPLOAD_DIR / "selfies" / current_user.id
    ).resolve()
    try:
        for selfie_path in selfie_paths:
            if selfie_path is None:
                raise ValueError
            selfie_path.relative_to(expected_selfie_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="自拍照文件不存在，请重新上传")

    profile = (
        db.query(FaceProfile)
        .filter(FaceProfile.user_id == current_user.id, FaceProfile.selfie_url == payload.selfie_url)
        .order_by(FaceProfile.created_at.desc(), FaceProfile.id)
        .first()
    )
    task = PortraitTask(
        user_id=current_user.id,
        style_id=style.id,
        selfie_url=payload.selfie_url,
        selfie_urls=selfie_urls,
        profile_name=profile.name if profile else None,
        user_prompt=payload.user_prompt,
        status="pending",
        prompt_used=generation_prompt,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    background_tasks.add_task(
        _run_generation,
        task.id,
        str(selfie_paths[0]),
        style_prompt,
        payload.user_prompt,
        style.name if payload.style_id else None,
        str(reference_path) if reference_path is not None else None,
        [str(path) for path in selfie_paths] if identity_count > 1 else None,
    )
    return _portrait_out(task)


def _run_generation(
    task_id: str,
    selfie_path: str,
    style_prompt: str | None,
    user_prompt: str | None,
    style_name: str | None = None,
    reference_path: str | None = None,
    identity_paths: list[str] | None = None,
):
    db = SessionLocal()
    try:
        task = db.query(PortraitTask).filter(PortraitTask.id == task_id).first()
        if not task:
            return
        task.status = "processing"
        db.commit()

        refined_prompt = prompt_analysis_service.analyze(user_prompt, style_name)
        generation_prompt = _build_generation_prompt(
            style_prompt, user_prompt, refined_prompt,
            has_template_reference=reference_path is not None,
            identity_count=len(identity_paths) if identity_paths else 1,
        )
        task.prompt_used = generation_prompt
        db.commit()

        if reference_path is not None or identity_paths:
            generation_options = {}
            if reference_path is not None:
                generation_options["reference_path"] = Path(reference_path)
            if identity_paths:
                generation_options["identity_paths"] = [Path(path) for path in identity_paths]
            image_data = ai_service.generate_portrait_sync(
                selfie_path, generation_prompt, **generation_options
            )
        else:
            image_data = ai_service.generate_portrait_sync(selfie_path, generation_prompt)

        from app.services.file_service import save_generated_image
        result_url = save_generated_image(image_data)

        task.result_url = result_url
        task.status = "completed"
        task.completed_at = datetime.utcnow()
        db.commit()
        logger.info(f"Portrait {task_id} completed: {result_url}")

    except Exception:
        logger.exception("Portrait %s failed", task_id)
        task = db.query(PortraitTask).filter(PortraitTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.error_message = PUBLIC_GENERATION_ERROR
            db.commit()

    finally:
        db.close()


@router.get("", response_model=list[PortraitOut])
def list_portraits(
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    tasks = (
        db.query(PortraitTask)
        .filter(PortraitTask.user_id == current_user.id)
        .order_by(PortraitTask.created_at.desc())
        .all()
    )
    return [_portrait_out(task) for task in tasks]


@router.get("/{portrait_id}", response_model=PortraitOut)
def get_portrait(
    portrait_id: str,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(PortraitTask)
        .filter(
            PortraitTask.id == portrait_id,
            PortraitTask.user_id == current_user.id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="写真不存在")
    return _portrait_out(task)


@router.get("/{portrait_id}/status", response_model=PortraitStatus)
def get_portrait_status(
    portrait_id: str,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(PortraitTask)
        .filter(
            PortraitTask.id == portrait_id,
            PortraitTask.user_id == current_user.id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="写真不存在")
    return PortraitStatus(
        id=task.id,
        status=task.status,
        result_url=_private_result_url(task),
        error_message=task.error_message,
    )


@router.delete("/{portrait_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portrait(
    portrait_id: str,
    current_user: User = Depends(get_current_invited_user),
    db: Session = Depends(get_db),
):
    task = (
        db.query(PortraitTask)
        .filter(
            PortraitTask.id == portrait_id,
            PortraitTask.user_id == current_user.id,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="写真不存在")
    db.delete(task)
    db.commit()
