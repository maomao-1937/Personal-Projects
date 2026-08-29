"""Add access-subject ownership to sessions."""

from alembic import op
import sqlalchemy as sa

revision = "20260825_0006"
down_revision = "20260825_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column(
            "owner_id",
            sa.String(length=64),
            server_default="legacy-local",
            nullable=False,
        ),
    )
    op.create_index(
        "ix_sessions_owner_id",
        "sessions",
        ["owner_id"],
        unique=False,
    )
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.alter_column(
            "owner_id",
            existing_type=sa.String(length=64),
            server_default=None,
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.drop_index("ix_sessions_owner_id")
        batch_op.drop_column("owner_id")
