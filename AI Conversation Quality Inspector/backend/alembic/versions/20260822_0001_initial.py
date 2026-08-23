"""Create invitation, analysis-attempt, and feedback tables.

Revision ID: 20260822_0001
Revises:
Create Date: 2026-08-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260822_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "invite_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("usage_limit", sa.Integer(), nullable=False),
        sa.Column("used_count", sa.Integer(), nullable=False),
        sa.Column("reserved_count", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("usage_limit > 0", name="ck_invite_limit_positive"),
        sa.CheckConstraint("used_count >= 0", name="ck_invite_used_nonnegative"),
        sa.CheckConstraint("reserved_count >= 0", name="ck_invite_reserved_nonnegative"),
        sa.CheckConstraint(
            "used_count + reserved_count <= usage_limit",
            name="ck_invite_counts_within_limit",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_digest"),
    )
    op.create_table(
        "analysis_attempts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("invite_code_id", sa.String(length=36), nullable=False),
        sa.Column("idempotency_key", sa.String(length=36), nullable=False),
        sa.Column("qa_type", sa.String(length=32), nullable=False),
        sa.Column("quota_status", sa.String(length=16), nullable=False),
        sa.Column("analysis_status", sa.String(length=24), nullable=True),
        sa.Column("char_count", sa.Integer(), nullable=False),
        sa.Column("turn_count", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("model_version", sa.String(length=120), nullable=True),
        sa.Column("rubric_version", sa.String(length=80), nullable=False),
        sa.Column("prompt_version", sa.String(length=80), nullable=False),
        sa.Column("scored_dimension_count", sa.Integer(), nullable=True),
        sa.Column("risk_level", sa.String(length=16), nullable=True),
        sa.Column("error_type", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("char_count >= 0", name="ck_attempt_char_count_nonnegative"),
        sa.CheckConstraint("turn_count >= 0", name="ck_attempt_turn_count_nonnegative"),
        sa.CheckConstraint(
            "scored_dimension_count IS NULL OR "
            "(scored_dimension_count >= 0 AND scored_dimension_count <= 6)",
            name="ck_attempt_scored_dimension_count",
        ),
        sa.ForeignKeyConstraint(["invite_code_id"], ["invite_codes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "invite_code_id",
            "idempotency_key",
            name="uq_attempt_invite_idempotency",
        ),
    )
    op.create_index(
        "ix_attempt_invite_created",
        "analysis_attempts",
        ["invite_code_id", "created_at"],
    )
    op.create_index(
        "ix_attempt_quota_created",
        "analysis_attempts",
        ["quota_status", "created_at"],
    )
    op.create_table(
        "feedback",
        sa.Column("analysis_id", sa.String(length=36), nullable=False),
        sa.Column("invite_code_id", sa.String(length=36), nullable=False),
        sa.Column("helpful", sa.Boolean(), nullable=False),
        sa.Column("reason_code", sa.String(length=24), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invite_code_id"], ["invite_codes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("analysis_id"),
    )


def downgrade() -> None:
    op.drop_table("feedback")
    op.drop_index("ix_attempt_quota_created", table_name="analysis_attempts")
    op.drop_index("ix_attempt_invite_created", table_name="analysis_attempts")
    op.drop_table("analysis_attempts")
    op.drop_table("invite_codes")
