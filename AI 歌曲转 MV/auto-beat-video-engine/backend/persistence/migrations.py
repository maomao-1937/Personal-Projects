from __future__ import annotations

import sqlite3


MIGRATION_V1 = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_codes (
    code_hash TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    expires_at TEXT,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    current_timeline_version_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
    ON projects(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    metadata_json TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audio_assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    version INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    duration_ms INTEGER,
    status TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS audio_analyses (
    id TEXT PRIMARY KEY,
    audio_asset_id TEXT NOT NULL REFERENCES audio_assets(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    result_json TEXT NOT NULL,
    status TEXT NOT NULL,
    job_id TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(audio_asset_id, version)
);

CREATE TABLE IF NOT EXISTS storyboards (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    plot_json TEXT NOT NULL,
    status TEXT NOT NULL,
    job_id TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS cuts (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    cut_version INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    spec_json TEXT NOT NULL,
    active_artifact_id TEXT REFERENCES artifacts(id),
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(storyboard_id, order_index)
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    input_json TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    provider_request_id TEXT,
    worker_id TEXT,
    lease_expires_at TEXT,
    heartbeat_at TEXT,
    deadline_at TEXT,
    progress REAL NOT NULL DEFAULT 0,
    attempt INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    result_artifact_id TEXT REFERENCES artifacts(id),
    error_json TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);

CREATE TABLE IF NOT EXISTS job_events (
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(job_id, sequence)
);

CREATE TABLE IF NOT EXISTS timeline_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, version),
    UNIQUE(project_id, content_hash)
);

CREATE TABLE IF NOT EXISTS previews (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    timeline_version_id TEXT NOT NULL REFERENCES timeline_versions(id),
    completeness TEXT NOT NULL,
    status TEXT NOT NULL,
    job_id TEXT REFERENCES jobs(id),
    artifact_id TEXT REFERENCES artifacts(id),
    stale_reason TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    timeline_version_id TEXT NOT NULL REFERENCES timeline_versions(id),
    aspect_ratio TEXT NOT NULL,
    resolution TEXT NOT NULL,
    status TEXT NOT NULL,
    job_id TEXT REFERENCES jobs(id),
    artifact_id TEXT REFERENCES artifacts(id),
    stale_reason TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE(timeline_version_id, aspect_ratio)
);
"""


def apply_migrations(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    applied = {
        row[0]
        for row in connection.execute("SELECT version FROM schema_migrations").fetchall()
    }
    if 1 not in applied:
        connection.executescript(MIGRATION_V1)
        connection.execute("INSERT INTO schema_migrations(version) VALUES (1)")

