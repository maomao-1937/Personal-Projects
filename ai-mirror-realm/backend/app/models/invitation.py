from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String

from app.database import Base
from app.models.user import gen_uuid


class InvitationToken(Base):
    __tablename__ = "invitation_tokens"

    id = Column(String, primary_key=True, default=gen_uuid)
    token_digest = Column(String(64), nullable=False, unique=True, index=True)
    token_hint = Column(String(8), nullable=False)
    label = Column(String(120), nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    revoked_at = Column(DateTime, nullable=True)
    redeemed_at = Column(DateTime, nullable=True)
    redeemed_by_user_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=True,
        unique=True,
        index=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
