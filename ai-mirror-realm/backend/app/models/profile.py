from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import gen_uuid


class FaceProfile(Base):
    __tablename__ = "face_profiles"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(30), nullable=False)
    selfie_url = Column(Text, nullable=False)
    selfie_urls = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", backref="face_profiles")
