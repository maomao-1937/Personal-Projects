from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class OrderCreate(BaseModel):
    """创建订单请求 - 选择套餐 ID"""
    package_id: str


class PaymentConfirm(BaseModel):
    """模拟支付确认请求"""
    payment_method: str = "simulated"


class PackageOut(BaseModel):
    """套餐信息输出"""
    id: str
    name: str
    credits: int
    price: int  # 单位：分
    original_price: int  # 原价，单位：分
    discount_text: Optional[str] = None
    recommended: bool = False


class OrderOut(BaseModel):
    """订单完整信息输出"""
    id: str
    user_id: str
    amount: int
    credits: int
    status: str
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    created_at: datetime
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True
