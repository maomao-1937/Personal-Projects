import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  ConceptStatus,
  SupportLevel,
  TrainingStage,
} from "@/lib/domain";

export type MapStatus = "processing" | "ready" | "failed";

export interface StudySession {
  id: string;
  clientRequestId: string | null;
  title: string;
  sourceText: string;
  mapStatus: MapStatus;
  mapError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Concept {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  sourceContext: string;
  status: ConceptStatus;
  trainingStage: TrainingStage;
  supportLevel: SupportLevel;
  currentQuestion: string | null;
  currentSupportContent: string | null;
  stateVersion: number;
  isRetraining: boolean;
  sortOrder: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptDraft {
  title: string;
  description: string;
  sourceContext: string;
}

export interface SessionWithConcepts extends StudySession {
  concepts: Concept[];
}

export interface RecentSession extends StudySession {
  conceptCount: number;
  masteredCount: number;
}

interface SessionRow {
  id: string;
  client_request_id: string | null;
  title: string;
  source_text: string;
  map_status: MapStatus;
  map_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConceptRow {
  id: string;
  session_id: string;
  title: string;
  description: string;
  source_context: string;
  status: ConceptStatus;
  training_stage: TrainingStage;
  support_level: SupportLevel;
  current_question: string | null;
  current_support_content: string | null;
  state_version: number;
  is_retraining: 0 | 1;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapSession(row: SessionRow): StudySession {
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    title: row.title,
    sourceText: row.source_text,
    mapStatus: row.map_status,
    mapError: row.map_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConcept(row: ConceptRow): Concept {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    description: row.description,
    sourceContext: row.source_context,
    status: row.status,
    trainingStage: row.training_stage,
    supportLevel: row.support_level,
    currentQuestion: row.current_question,
    currentSupportContent: row.current_support_content,
    stateVersion: row.state_version,
    isRetraining: row.is_retraining === 1,
    sortOrder: row.sort_order,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSessionRepository(db: Database.Database) {
  const getSessionStatement = db.prepare(
    "SELECT * FROM study_sessions WHERE id = ?",
  );
  const getConceptStatement = db.prepare("SELECT * FROM concepts WHERE id = ?");

  return {
    createProcessing(input: {
      clientRequestId?: string;
      title: string;
      sourceText: string;
    }): StudySession {
      const id = randomUUID();
      const clientRequestId = input.clientRequestId ?? randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO study_sessions (
          id, client_request_id, title, source_text, map_status, map_error,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'processing', NULL, ?, ?)`,
      ).run(id, clientRequestId, input.title, input.sourceText, now, now);

      return mapSession(getSessionStatement.get(id) as SessionRow);
    },

    getByClientRequestId(clientRequestId: string): StudySession | null {
      const row = db
        .prepare("SELECT * FROM study_sessions WHERE client_request_id = ?")
        .get(clientRequestId) as SessionRow | undefined;
      return row ? mapSession(row) : null;
    },

    markMapFailed(sessionId: string, message: string): void {
      const result = db
        .prepare(
          `UPDATE study_sessions
           SET map_status = 'failed', map_error = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(message, new Date().toISOString(), sessionId);

      if (result.changes === 0) {
        throw new Error("Session 不存在");
      }
    },

    markMapProcessing(sessionId: string): void {
      const result = db
        .prepare(
          `UPDATE study_sessions
           SET map_status = 'processing', map_error = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .run(new Date().toISOString(), sessionId);

      if (result.changes === 0) {
        throw new Error("Session 不存在");
      }
    },

    replaceConceptsAndMarkReady(
      sessionId: string,
      drafts: ConceptDraft[],
    ): Concept[] {
      const replace = db.transaction(() => {
        if (!getSessionStatement.get(sessionId)) {
          throw new Error("Session 不存在");
        }

        db.prepare(
          "DELETE FROM concepts WHERE session_id = ? AND status = 'not_started'",
        ).run(sessionId);

        const insert = db.prepare(
          `INSERT INTO concepts (
            id, session_id, title, description, source_context, status,
            training_stage, support_level, current_question,
            current_support_content, sort_order, started_at, completed_at,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, 'not_started', 'initial_explanation', 0, NULL,
            NULL, ?, NULL, NULL, ?, ?
          )`,
        );
        const now = new Date().toISOString();
        const insertedIds: string[] = [];

        drafts.forEach((draft, index) => {
          const id = randomUUID();
          insertedIds.push(id);
          insert.run(
            id,
            sessionId,
            draft.title,
            draft.description,
            draft.sourceContext,
            index,
            now,
            now,
          );
        });

        db.prepare(
          `UPDATE study_sessions
           SET map_status = 'ready', map_error = NULL, updated_at = ?
           WHERE id = ?`,
        ).run(now, sessionId);

        return insertedIds.map((id) =>
          mapConcept(getConceptStatement.get(id) as ConceptRow),
        );
      });

      return replace();
    },

    listRecent(limit: number): RecentSession[] {
      const rows = db
        .prepare(
          `SELECT s.*,
             COUNT(c.id) AS concept_count,
             COALESCE(SUM(CASE WHEN c.status = 'mastered' THEN 1 ELSE 0 END), 0)
               AS mastered_count
           FROM study_sessions s
           LEFT JOIN concepts c ON c.session_id = s.id
           GROUP BY s.id
           ORDER BY s.updated_at DESC
           LIMIT ?`,
        )
        .all(limit) as Array<
        SessionRow & { concept_count: number; mastered_count: number }
      >;

      return rows.map((row) => ({
        ...mapSession(row),
        conceptCount: row.concept_count,
        masteredCount: row.mastered_count,
      }));
    },

    getSessionWithConcepts(sessionId: string): SessionWithConcepts | null {
      const sessionRow = getSessionStatement.get(sessionId) as
        | SessionRow
        | undefined;
      if (!sessionRow) {
        return null;
      }

      const conceptRows = db
        .prepare(
          "SELECT * FROM concepts WHERE session_id = ? ORDER BY sort_order ASC",
        )
        .all(sessionId) as ConceptRow[];

      return {
        ...mapSession(sessionRow),
        concepts: conceptRows.map(mapConcept),
      };
    },

    getConceptWithSession(
      conceptId: string,
    ): { concept: Concept; session: StudySession } | null {
      const conceptRow = getConceptStatement.get(conceptId) as
        | ConceptRow
        | undefined;
      if (!conceptRow) {
        return null;
      }

      const sessionRow = getSessionStatement.get(conceptRow.session_id) as
        | SessionRow
        | undefined;
      if (!sessionRow) {
        return null;
      }

      return {
        concept: mapConcept(conceptRow),
        session: mapSession(sessionRow),
      };
    },
  };
}
