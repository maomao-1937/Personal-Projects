import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text

from app.database import Base
from app.models.user import gen_uuid


class Style(Base):
    __tablename__ = "styles"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    prompt_template = Column(Text, nullable=False)
    preview_url = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
