import type Database from "better-sqlite3";

interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "create_core_tables",
    sql: `
      CREATE TABLE study_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_text TEXT NOT NULL,
        map_status TEXT NOT NULL CHECK (map_status IN ('processing', 'ready', 'failed')),
        map_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE concepts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        source_context TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('not_started', 'learning', 'needs_review', 'mastered')),
        training_stage TEXT NOT NULL CHECK (training_stage IN ('initial_explanation', 'validation_probe', 'targeted_probe', 'support', 'retest', 'complete')),
        support_level INTEGER NOT NULL DEFAULT 0 CHECK (support_level BETWEEN 0 AND 3),
        current_question TEXT,
        current_support_content TEXT,
        sort_order INTEGER NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX concepts_session_order_idx
        ON concepts(session_id, sort_order);

      CREATE TABLE practice_attempts (
        id TEXT PRIMARY KEY,
        concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
        client_request_id TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL CHECK (kind IN ('explanation', 'followup', 'retest')),
        question TEXT NOT NULL,
        user_answer TEXT NOT NULL,
        processing_status TEXT NOT NULL CHECK (processing_status IN ('pending', 'completed', 'failed')),
        assessment TEXT CHECK (assessment IN ('correct', 'partial', 'incorrect', 'unclear')),
        understood_points_json TEXT NOT NULL DEFAULT '[]',
        missing_points_json TEXT NOT NULL DEFAULT '[]',
        misconceptions_json TEXT NOT NULL DEFAULT '[]',
        next_question TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX practice_attempts_concept_created_idx
        ON practice_attempts(concept_id, created_at);

      CREATE TABLE knowledge_gaps (
        id TEXT PRIMARY KEY,
        concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
        gap_type TEXT NOT NULL CHECK (gap_type IN ('missing', 'misconception')),
        description TEXT NOT NULL,
        normalized_description TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        first_detected_attempt_id TEXT NOT NULL REFERENCES practice_attempts(id) ON DELETE CASCADE,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX knowledge_gaps_open_unique_idx
        ON knowledge_gaps(concept_id, gap_type, normalized_description)
        WHERE status = 'open';

      CREATE TABLE analytics_events (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES study_sessions(id) ON DELETE CASCADE,
        concept_id TEXT REFERENCES concepts(id) ON DELETE CASCADE,
        event_name TEXT NOT NULL CHECK (event_name IN (
          'session_created',
          'concept_started',
          'explanation_submitted',
          'followup_answered',
          'hint_requested',
          'concept_mastered',
          'concept_abandoned'
        )),
        properties_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX analytics_events_session_created_idx
        ON analytics_events(session_id, created_at);
    `,
  },
  {
    version: 2,
    name: "add_idempotency_and_concept_versions",
    sql: `
      ALTER TABLE study_sessions ADD COLUMN client_request_id TEXT;
      CREATE UNIQUE INDEX study_sessions_client_request_unique_idx
        ON study_sessions(client_request_id)
        WHERE client_request_id IS NOT NULL;

      ALTER TABLE concepts
        ADD COLUMN state_version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE concepts
        ADD COLUMN is_retraining INTEGER NOT NULL DEFAULT 0
        CHECK (is_retraining IN (0, 1));

      ALTER TABLE practice_attempts
        ADD COLUMN concept_version INTEGER NOT NULL DEFAULT 0;
    `,
  },
] as const;

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (
      db.prepare("SELECT version FROM schema_migrations").all() as Array<{
        version: number;
      }>
    ).map(({ version }) => version),
  );

  const applyPending = db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) {
        continue;
      }

      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, new Date().toISOString());
    }
  });

  applyPending();
}
