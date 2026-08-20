"""邀请制门禁。

- POST /invite/redeem  前端进入时核销一次(消耗 1 次额度,返回剩余)
- GET  /invite/status  查询某码剩余次数(不消耗)
- verify_invite        FastAPI 依赖:业务接口强制校验 X-Invite-Code(不消耗额度)
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db import get_db
from app.models.models import InviteCode

router = APIRouter(tags=["invite"])


class RedeemRequest(BaseModel):
    code: str


class RedeemResponse(BaseModel):
    ok: bool
    remaining: int  # 剩余可用次数(含本次)


def _normalize(code: str) -> str:
    return (code or "").strip().upper()


def _load(db: Session, code: str) -> InviteCode:
    """加载并校验邀请码,返回 ORM 对象;无效则抛业务错误。"""
    ic = db.query(InviteCode).filter(InviteCode.code == code).first()
    if ic is None:
        raise AppError("invite_invalid", "邀请码不存在,请检查输入", 403)
    if not ic.active:
        raise AppError("invite_disabled", "该邀请码已被停用", 403)
    if ic.used_count >= ic.max_uses:
        raise AppError(
            "invite_exhausted",
            f"该邀请码已用完({ic.max_uses} 次),请联系发放人获取新码",
            403,
        )
    return ic


@router.post("/invite/redeem", response_model=RedeemResponse)
def redeem(body: RedeemRequest, db: Session = Depends(get_db)):
    """核销一次。同一浏览器核销后由前端记住,不会重复消耗。"""
    code = _normalize(body.code)
    if not code:
        raise AppError("invite_invalid", "请输入邀请码", 400)
    ic = _load(db, code)
    ic.used_count += 1
    ic.last_used_at = datetime.utcnow()
    db.commit()
    return RedeemResponse(ok=True, remaining=ic.max_uses - ic.used_count)


@router.get("/invite/status")
def status(code: str, db: Session = Depends(get_db)):
    """查询剩余次数,不消耗额度。"""
    c = _normalize(code)
    ic = db.query(InviteCode).filter(InviteCode.code == c).first()
    if ic is None:
        raise AppError("invite_invalid", "邀请码不存在", 404)
    return {
        "code": ic.code,
        "active": ic.active,
        "used_count": ic.used_count,
        "max_uses": ic.max_uses,
        "remaining": max(0, ic.max_uses - ic.used_count),
    }


def verify_invite(
    db: Session = Depends(get_db),
    x_invite_code: str = Header(default=""),
) -> str:
    """业务接口(验收/审查/改写)的强制校验依赖:验码但不扣次数。"""
    code = _normalize(x_invite_code)
    if not code:
        raise AppError("invite_required", "缺少邀请码,请从首页凭邀请码进入", 401)
    _load(db, code)
    return code
