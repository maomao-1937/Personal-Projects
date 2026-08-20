"""数据模型。Job / ChecklistItem / Evidence / Finding。状态机见阶段文档第六节。"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String, nullable=False)  # acceptance | review
    prd_text = Column(Text, nullable=False)
    target_url = Column(Text, nullable=True)
    allow_destructive = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending|running|done|failed
    error_message = Column(Text, nullable=True)
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    checklist_items = relationship(
        "ChecklistItem", back_populates="job", cascade="all, delete-orphan",
        order_by="ChecklistItem.seq",
    )
    findings = relationship(
        "Finding", back_populates="job", cascade="all, delete-orphan"
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False, index=True)
    seq = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)  # 要验证的行为
    expected = Column(Text, nullable=False)  # 期望结果
    destructive = Column(Boolean, default=False, nullable=False)
    status = Column(
        String, default="pending", nullable=False
    )  # pending|running|passed|failed|skipped
    judge_result = Column(Text, nullable=True)  # pass|fail
    judge_reason = Column(Text, nullable=True)
    job = relationship("Job", back_populates="checklist_items")
    evidence = relationship(
        "Evidence", back_populates="item", cascade="all, delete-orphan"
    )


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = Column(
        String, ForeignKey("checklist_items.id"), nullable=False, index=True
    )
    kind = Column(String, nullable=False)  # screenshot|dom|text|trace
    path = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("ChecklistItem", back_populates="evidence")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False, index=True)
    item_id = Column(String, ForeignKey("checklist_items.id"), nullable=True)  # review 模式可空
    severity = Column(String, nullable=False)  # high|medium|low
    category = Column(String, nullable=False)  # logic_gap|missing|contradiction|ambiguous|bug|ux
    message = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=False)
    job = relationship("Job", back_populates="findings")


class InviteCode(Base):
    """邀请码。每个码可被核销 max_uses 次(默认 5 次 = 5 个设备/浏览器)。"""

    __tablename__ = "invite_codes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, unique=True, index=True, nullable=False)  # 形如 SHIP-AB12-CD34
    max_uses = Column(Integer, default=5, nullable=False)
    used_count = Column(Integer, default=0, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    note = Column(String, nullable=True)  # 备注:发给谁
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
