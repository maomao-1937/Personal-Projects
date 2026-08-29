"""Expand dynamic case IDs and support pending turn reservations."""

from alembic import op
import sqlalchemy as sa

revision = "20260825_0005"
down_revision = "20260825_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.alter_column(
            "case_id",
            existing_type=sa.String(length=32),
            type_=sa.String(length=64),
            existing_nullable=False,
        )
    with op.batch_alter_table("turn_requests") as batch_op:
        batch_op.alter_column(
            "outcome_json",
            existing_type=sa.Text(),
            nullable=True,
        )


def downgrade() -> None:
    op.execute("DELETE FROM turn_requests WHERE outcome_json IS NULL")
    with op.batch_alter_table("turn_requests") as batch_op:
        batch_op.alter_column(
            "outcome_json",
            existing_type=sa.Text(),
            nullable=False,
        )
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.alter_column(
            "case_id",
            existing_type=sa.String(length=64),
            type_=sa.String(length=32),
            existing_nullable=False,
        )
