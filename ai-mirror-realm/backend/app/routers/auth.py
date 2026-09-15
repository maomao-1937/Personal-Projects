from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserOut, AuthSession
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_invited_user,
    set_auth_cookie,
    clear_auth_cookie,
)
from app.services.invitation_service import redeem_invitation
from app.utils.rate_limiter import limiter

router = APIRouter(prefix="/api/auth", tags=["认证"])


def _account_exists(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "ACCOUNT_EXISTS", "message": message},
    )


@router.post("/register", response_model=AuthSession, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
def register(
    request: Request,
    response: Response,
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    """用户注册

    速率限制：同一 IP 每小时最多 3 次
    """
    if payload.phone and db.query(User).filter(User.phone == payload.phone).first():
        raise _account_exists("该手机号已注册")
    if payload.email and db.query(User).filter(User.email == payload.email).first():
        raise _account_exists("该邮箱已注册")

    invited_at = datetime.utcnow()
    try:
        user = User(
            phone=payload.phone,
            email=payload.email,
            password_hash=hash_password(payload.password),
            nickname=payload.nickname or "镜界用户",
            credits=0,
        )
        db.add(user)
        db.flush()

        if not redeem_invitation(
            db,
            raw_token=payload.invite_token,
            user_id=user.id,
            now=invited_at,
        ):
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INVITE_UNAVAILABLE",
                    "message": "邀请码无效或已失效",
                },
            )

        user.invited_at = invited_at
        db.commit()
        db.refresh(user)
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise _account_exists("该账号已注册")

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return AuthSession(user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthSession)
@limiter.limit("5/minute")
def login(
    request: Request,
    response: Response,
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    """用户登录

    速率限制：同一 IP 每分钟最多 5 次
    """
    user = (
        db.query(User)
        .filter((User.phone == payload.account) | (User.email == payload.account))
        .first()
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    if user.invited_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "INVITE_REQUIRED",
                "message": "该账号尚未获得内测访问资格",
            },
        )

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return AuthSession(user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_invited_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    clear_auth_cookie(response)
    return None
