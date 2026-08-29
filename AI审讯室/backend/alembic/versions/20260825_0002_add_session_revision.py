"""Add optimistic-lock revision to sessions."""

from alembic import op
import sqlalchemy as sa

revision = "20260825_0002"
down_revision = "20260825_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("revision", sa.Integer(), server_default="1", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("sessions", "revision")
