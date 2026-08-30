import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import gen_uuid


class PortraitTask(Base):
    __tablename__ = "portrait_tasks"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    style_id = Column(String, ForeignKey("styles.id"), nullable=False, index=True)
    selfie_url = Column(Text, nullable=False)
    result_url = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    prompt_used = Column(Text, nullable=True)
    credits_used = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", backref="portraits")
    style = relationship("Style", backref="portraits")
