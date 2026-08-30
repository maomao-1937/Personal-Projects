from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.style import Style
from app.models.user import User
from app.schemas.style import StyleOut, StyleDetail
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/styles", tags=["风格模板"])


@router.get("", response_model=list[StyleOut])
def list_styles(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Style).filter(Style.is_active == True)
    if category:
        query = query.filter(Style.category == category)
    return query.order_by(Style.sort_order).all()


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(Style.category)
        .filter(Style.is_active == True)
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


@router.get("/{style_id}", response_model=StyleDetail)
def get_style(style_id: str, db: Session = Depends(get_db)):
    style = db.query(Style).filter(Style.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="风格不存在")
    return style
