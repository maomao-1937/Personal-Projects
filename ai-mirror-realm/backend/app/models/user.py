import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Boolean
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(100), nullable=False, default="镜界用户")
    avatar_url = Column(TEXT, nullable=True)
    credits = Column(Integer, nullable=False, default=3)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联订单
    orders = relationship("Order", back_populates="user")
