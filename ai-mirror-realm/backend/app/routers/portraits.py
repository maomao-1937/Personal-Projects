import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.portrait import PortraitTask
from app.models.style import Style
from app.models.user import User
from app.schemas.portrait import PortraitCreate, PortraitOut, PortraitStatus
from app.services.ai_service import ai_service
from app.services.auth_service import get_current_user
from app.utils.file_utils import resolve_media_path
from app.utils.rate_limiter import limiter, get_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portraits", tags=["AI 写真"])


@router.post("", response_model=PortraitOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute", key_func=get_user_id)
def create_portrait(
    request: Request,
    payload: PortraitCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建 AI 写真任务

    速率限制：同一用户每分钟最多 2 次
    """
    style = db.query(Style).filter(Style.id == payload.style_id).first()
    if not style or not style.is_active:
        raise HTTPException(status_code=404, detail="风格不存在或已下架")

    selfie_path = resolve_media_path(payload.selfie_url, must_exist=True)
    if not selfie_path:
        raise HTTPException(status_code=400, detail="自拍照文件不存在，请重新上传")

    result = (
        db.query(User)
        .filter(User.id == current_user.id, User.credits >= 1)
        .update({"credits": User.credits - 1}, synchronize_session=False)
    )
    if result == 0:
        raise HTTPException(status_code=402, detail="积分不足，请充值")
    db.commit()
    db.refresh(current_user)

    task = PortraitTask(
        user_id=current_user.id,
        style_id=style.id,
        selfie_url=payload.selfie_url,
        status="pending",
        prompt_used=style.prompt_template,
        credits_used=1,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    background_tasks.add_task(
        _run_generation, task.id, str(selfie_path), style.prompt_template
    )
    return task


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

    except Exception as e:
        logger.error(f"Portrait {task_id} failed: {e}")
        task = db.query(PortraitTask).filter(PortraitTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.error_message = str(e)[:500]
            db.commit()
            _refund_credits(db, task.user_id, task.credits_used)

    finally:
        db.close()


def _refund_credits(db: Session, user_id: str, amount: int):
    try:
        db.query(User).filter(User.id == user_id).update(
            {"credits": User.credits + amount}, synchronize_session=False
        )
        db.commit()
        logger.info(f"Refunded {amount} credits to user {user_id}")
    except Exception as e:
        logger.error(f"Failed to refund credits: {e}")
        db.rollback()


@router.get("", response_model=list[PortraitOut])
def list_portraits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(PortraitTask)
        .filter(PortraitTask.user_id == current_user.id)
        .order_by(PortraitTask.created_at.desc())
        .all()
    )


@router.get("/{portrait_id}", response_model=PortraitOut)
def get_portrait(
    portrait_id: str,
    current_user: User = Depends(get_current_user),
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
    return task


@router.get("/{portrait_id}/status", response_model=PortraitStatus)
def get_portrait_status(
    portrait_id: str,
    current_user: User = Depends(get_current_user),
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
        result_url=task.result_url,
        error_message=task.error_message,
    )


@router.delete("/{portrait_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portrait(
    portrait_id: str,
    current_user: User = Depends(get_current_user),
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
