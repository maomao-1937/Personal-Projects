"""Create the initial MeetingMemo schema."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "invite_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("max_redemptions", sa.Integer(), nullable=False),
        sa.Column("redemption_count", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_index("ix_invite_codes_code_hash", "invite_codes", ["code_hash"])
    op.create_index("ix_invite_codes_is_active", "invite_codes", ["is_active"])

    op.create_table(
        "access_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "invite_code_id",
            sa.String(36),
            sa.ForeignKey("invite_codes.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_access_sessions_invite_code_id", "access_sessions", ["invite_code_id"])
    op.create_index("ix_access_sessions_token_hash", "access_sessions", ["token_hash"])
    op.create_index("ix_access_sessions_expires_at", "access_sessions", ["expires_at"])

    op.create_table(
        "meetings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("meeting_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timezone", sa.String(80), nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("language", sa.String(16), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_meetings_status", "meetings", ["status"])

    op.create_table(
        "transcript_segments",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "meeting_id",
            sa.String(36),
            sa.ForeignKey("meetings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("start_ms", sa.Integer(), nullable=True),
        sa.Column("end_ms", sa.Integer(), nullable=True),
        sa.Column("speaker", sa.String(160), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("meeting_id", "sequence"),
    )
    op.create_index("ix_transcript_segments_meeting_id", "transcript_segments", ["meeting_id"])

    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "meeting_id",
            sa.String(36),
            sa.ForeignKey("meetings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("worker_id", sa.String(80), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(80), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("trace_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_processing_jobs_meeting_id", "processing_jobs", ["meeting_id"])
    op.create_index("ix_processing_jobs_status", "processing_jobs", ["status"])
    op.create_index(
        "uq_active_summary_job_per_meeting",
        "processing_jobs",
        ["meeting_id", "job_type"],
        unique=True,
        sqlite_where=sa.text("job_type = 'summary' AND status IN ('queued', 'running')"),
        postgresql_where=sa.text("job_type = 'summary' AND status IN ('queued', 'running')"),
    )

    op.create_table(
        "summary_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "meeting_id",
            sa.String(36),
            sa.ForeignKey("meetings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("schema_version", sa.String(16), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("quality_flags", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column(
            "parent_version_id",
            sa.String(36),
            sa.ForeignKey("summary_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_source", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("meeting_id", "version"),
    )
    op.create_index("ix_summary_versions_meeting_id", "summary_versions", ["meeting_id"])
    op.create_index("ix_summary_versions_status", "summary_versions", ["status"])

    op.create_table(
        "deliveries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "summary_version_id",
            sa.String(36),
            sa.ForeignKey("summary_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", sa.String(32), nullable=False),
        sa.Column("target_fingerprint", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("receipt", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(80), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_deliveries_summary_version_id", "deliveries", ["summary_version_id"])
    op.create_index("ix_deliveries_idempotency_key", "deliveries", ["idempotency_key"])
    op.create_index("ix_deliveries_status", "deliveries", ["status"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_fingerprint", sa.String(64), nullable=True),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("resource_type", sa.String(80), nullable=False),
        sa.Column("resource_id", sa.String(64), nullable=True),
        sa.Column("result", sa.String(32), nullable=False),
        sa.Column("trace_id", sa.String(64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_events_session_fingerprint", "audit_events", ["session_fingerprint"])
    op.create_index("ix_audit_events_action", "audit_events", ["action"])

    op.create_table(
        "feedback",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "meeting_id",
            sa.String(36),
            sa.ForeignKey("meetings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "summary_version_id",
            sa.String(36),
            sa.ForeignKey("summary_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("error_types", sa.JSON(), nullable=False),
        sa.Column("comment", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_feedback_meeting_id", "feedback", ["meeting_id"])
    op.create_index("ix_feedback_summary_version_id", "feedback", ["summary_version_id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_summary_version_id", table_name="feedback")
    op.drop_index("ix_feedback_meeting_id", table_name="feedback")
    op.drop_table("feedback")
    op.drop_index("ix_audit_events_action", table_name="audit_events")
    op.drop_index("ix_audit_events_session_fingerprint", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_deliveries_status", table_name="deliveries")
    op.drop_index("ix_deliveries_idempotency_key", table_name="deliveries")
    op.drop_index("ix_deliveries_summary_version_id", table_name="deliveries")
    op.drop_table("deliveries")
    op.drop_index("ix_summary_versions_status", table_name="summary_versions")
    op.drop_index("ix_summary_versions_meeting_id", table_name="summary_versions")
    op.drop_table("summary_versions")
    op.drop_index("uq_active_summary_job_per_meeting", table_name="processing_jobs")
    op.drop_index("ix_processing_jobs_status", table_name="processing_jobs")
    op.drop_index("ix_processing_jobs_meeting_id", table_name="processing_jobs")
    op.drop_table("processing_jobs")
    op.drop_index("ix_transcript_segments_meeting_id", table_name="transcript_segments")
    op.drop_table("transcript_segments")
    op.drop_index("ix_meetings_status", table_name="meetings")
    op.drop_table("meetings")
    op.drop_index("ix_access_sessions_expires_at", table_name="access_sessions")
    op.drop_index("ix_access_sessions_token_hash", table_name="access_sessions")
    op.drop_index("ix_access_sessions_invite_code_id", table_name="access_sessions")
    op.drop_table("access_sessions")
    op.drop_index("ix_invite_codes_is_active", table_name="invite_codes")
    op.drop_index("ix_invite_codes_code_hash", table_name="invite_codes")
    op.drop_table("invite_codes")
