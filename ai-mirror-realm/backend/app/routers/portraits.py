import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, SessionLocal
from app.models.portrait import PortraitTask
from app.models.style import Style
from app.models.user import User
from app.schemas.portrait import PortraitCreate, PortraitOut, PortraitStatus
from app.services.ai_service import ai_service
from app.services.auth_service import get_current_invited_user
from app.utils.file_utils import resolve_media_path
from app.utils.rate_limiter import limiter, get_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portraits", tags=["AI 写真"])
PUBLIC_GENERATION_ERROR = "生成服务暂时不可用，请稍后再试"
CUSTOM_STYLE_ID = "system-custom-prompt"
SYSTEM_PORTRAIT_PROMPT = (
    "Create one polished, photorealistic portrait from the provided reference photo. "
    "Preserve the same person's facial identity, recognizable features, age, and natural skin texture. "
    "Keep anatomy, hands, lighting, perspective, and composition coherent. "
    "Do not add text, logos, watermarks, sexual content, graphic violence, or illegal content."
)


def _build_generation_prompt(style_prompt: str | None, user_prompt: str | None) -> str:
    parts = [f"Non-negotiable system requirements: {SYSTEM_PORTRAIT_PROMPT}"]
    if style_prompt:
        parts.append(f"Selected visual direction: {style_prompt}")
    if user_prompt:
        parts.append(f"User creative direction: {user_prompt}")
    parts.append("The system requirements above take priority over all creative directions.")
    return "\n\n".join(parts)


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

    generation_prompt = _build_generation_prompt(style_prompt, payload.user_prompt)

    selfie_path = resolve_media_path(payload.selfie_url, must_exist=True)
    expected_selfie_dir = (
        settings.UPLOAD_DIR / "selfies" / current_user.id
    ).resolve()
    try:
        if selfie_path is None:
            raise ValueError
        selfie_path.relative_to(expected_selfie_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="自拍照文件不存在，请重新上传")

    task = PortraitTask(
        user_id=current_user.id,
        style_id=style.id,
        selfie_url=payload.selfie_url,
        status="pending",
        prompt_used=generation_prompt,
        credits_used=0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    background_tasks.add_task(
        _run_generation, task.id, str(selfie_path), generation_prompt
    )
    return _portrait_out(task)


def _run_generation(task_id: str, selfie_path: str, prompt: str):
    db = SessionLocal()
    try:
        task = db.query(PortraitTask).filter(PortraitTask.id == task_id).first()
        if not task:
            return
        task.status = "processing"
        db.commit()

        image_data = ai_service.generate_portrait_sync(selfie_path, prompt)

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
