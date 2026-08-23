"""Harden invite limits and add an atomic rate-limit bucket."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_invite_hardening"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("invite_codes") as batch_op:
        batch_op.create_check_constraint(
            "max_redemptions_range",
            "max_redemptions BETWEEN 1 AND 50",
        )
        batch_op.create_check_constraint(
            "redemption_count_range",
            "redemption_count BETWEEN 0 AND max_redemptions",
        )
    op.create_table(
        "invite_rate_limit_buckets",
        sa.Column("client_fingerprint", sa.String(64), primary_key=True),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "attempt_count >= 0",
            name="ck_invite_rate_limit_buckets_attempt_count_nonnegative",
        ),
    )
    op.create_index(
        "ix_invite_rate_limit_buckets_window_started_at",
        "invite_rate_limit_buckets",
        ["window_started_at"],
    )
    op.create_index("ix_meetings_created_at", "meetings", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_meetings_created_at", table_name="meetings")
    op.drop_index(
        "ix_invite_rate_limit_buckets_window_started_at",
        table_name="invite_rate_limit_buckets",
    )
    op.drop_table("invite_rate_limit_buckets")
    with op.batch_alter_table("invite_codes") as batch_op:
        batch_op.drop_constraint(
            "redemption_count_range",
            type_="check",
        )
        batch_op.drop_constraint(
            "max_redemptions_range",
            type_="check",
        )
