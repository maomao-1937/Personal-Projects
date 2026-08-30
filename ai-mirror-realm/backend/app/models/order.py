import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import gen_uuid


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False, comment="金额，单位：分")
    credits = Column(Integer, nullable=False, comment="积分数量")
    status = Column(String(20), default="pending", nullable=False, index=True, comment="订单状态：pending/paid/failed/refunded")
    payment_method = Column(String(50), nullable=True, comment="支付方式")
    transaction_id = Column(String(100), nullable=True, comment="支付交易号")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    paid_at = Column(DateTime, nullable=True)

    # 关联用户
    user = relationship("User", back_populates="orders")
