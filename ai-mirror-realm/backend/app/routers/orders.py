import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config.packages import get_all_packages, get_package
from app.database import get_db
from app.models.order import Order
from app.models.user import User
from app.schemas.order import OrderCreate, OrderOut, PackageOut, PaymentConfirm
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/orders", tags=["订单"])


@router.get("/packages", response_model=list[PackageOut])
def get_packages():
    """获取充值套餐列表"""
    packages = get_all_packages()
    return [PackageOut(**p.to_dict()) for p in packages]


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建订单（选择套餐，生成 pending 订单）"""
    package = get_package(payload.package_id)
    if not package:
        raise HTTPException(status_code=400, detail="无效的套餐 ID")

    order = Order(
        user_id=current_user.id,
        amount=package.price,
        credits=package.credits,
        status="pending",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return order


@router.post("/{order_id}/pay", response_model=OrderOut)
def confirm_payment(
    order_id: str,
    payload: PaymentConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """模拟支付确认

    将订单状态改为 paid，并增加用户积分。
    """
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order.status == "paid":
        raise HTTPException(status_code=400, detail="订单已支付")

    if order.status != "pending":
        raise HTTPException(status_code=400, detail=f"订单状态不支持支付：{order.status}")

    # 更新订单状态
    order.status = "paid"
    order.payment_method = payload.payment_method
    order.transaction_id = f"SIM_{uuid.uuid4().hex[:16].upper()}"
    order.paid_at = datetime.utcnow()

    # 增加用户积分
    current_user.credits += order.credits

    db.commit()
    db.refresh(order)

    return order


@router.get("", response_model=list[OrderOut])
def get_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的订单列表（按创建时间倒序）"""
    orders = (
        db.query(Order)
        .filter(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return orders
