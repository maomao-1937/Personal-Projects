import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type {
  Assessment,
  AttemptKind,
  ConceptStatus,
  GapStatus,
  GapType,
  SupportLevel,
  TrainingStage,
} from "@/lib/domain";
import {
  mapConcept,
  type Concept,
  type ConceptRow,
} from "@/server/repositories/session-repository";

export type AttemptProcessingStatus = "pending" | "completed" | "failed";

export class ConcurrentConceptUpdateError extends Error {
  constructor(message = "训练状态已在其他请求中更新") {
    super(message);
    this.name = "ConcurrentConceptUpdateError";
  }
}

export interface PracticeAttempt {
  id: string;
  conceptId: string;
  clientRequestId: string;
  conceptVersion: number;
  kind: AttemptKind;
  question: string;
  userAnswer: string;
  processingStatus: AttemptProcessingStatus;
  assessment: Assessment | null;
  understoodPoints: string[];
  missingPoints: string[];
  misconceptions: string[];
  nextQuestion: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGap {
  id: string;
  conceptId: string;
  gapType: GapType;
  description: string;
  status: GapStatus;
  firstDetectedAttemptId: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingView {
  concept: Concept;
  attempts: PracticeAttempt[];
  openGaps: KnowledgeGap[];
  resolvedGaps: KnowledgeGap[];
}

interface AttemptRow {
  id: string;
  concept_id: string;
  client_request_id: string;
  concept_version: number;
  kind: AttemptKind;
  question: string;
  user_answer: string;
  processing_status: AttemptProcessingStatus;
  assessment: Assessment | null;
  understood_points_json: string;
  missing_points_json: string;
  misconceptions_json: string;
  next_question: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface GapRow {
  id: string;
  concept_id: string;
  gap_type: GapType;
  description: string;
  status: GapStatus;
  first_detected_attempt_id: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CompleteAttemptInput {
  attemptId: string;
  expectedConceptVersion: number;
  assessment: Assessment;
  understoodPoints: string[];
  missingPoints: string[];
  misconceptions: string[];
  nextQuestion: string;
  transition: {
    stage: TrainingStage;
    status: ConceptStatus;
    supportLevel: SupportLevel;
    currentQuestion: string | null;
  };
}

function parseStringArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("数据库中的字符串数组格式无效");
  }
  return parsed;
}

function mapAttempt(row: AttemptRow): PracticeAttempt {
  return {
    id: row.id,
    conceptId: row.concept_id,
    clientRequestId: row.client_request_id,
    conceptVersion: row.concept_version,
    kind: row.kind,
    question: row.question,
    userAnswer: row.user_answer,
    processingStatus: row.processing_status,
    assessment: row.assessment,
    understoodPoints: parseStringArray(row.understood_points_json),
    missingPoints: parseStringArray(row.missing_points_json),
    misconceptions: parseStringArray(row.misconceptions_json),
    nextQuestion: row.next_question,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGap(row: GapRow): KnowledgeGap {
  return {
    id: row.id,
    conceptId: row.concept_id,
    gapType: row.gap_type,
    description: row.description,
    status: row.status,
    firstDetectedAttemptId: row.first_detected_attempt_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeGapDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

export function createTrainingRepository(db: Database.Database) {
  const getAttemptStatement = db.prepare(
    "SELECT * FROM practice_attempts WHERE id = ?",
  );
  const getConceptStatement = db.prepare("SELECT * FROM concepts WHERE id = ?");

  return {
    startConcept(
      conceptId: string,
      initialQuestion: string,
      expectedVersion?: number,
    ): Concept {
      const current = getConceptStatement.get(conceptId) as ConceptRow | undefined;
      if (!current) {
        throw new Error("Concept 不存在");
      }
      const now = new Date().toISOString();
      const version = expectedVersion ?? current.state_version;
      const result = db
        .prepare(
          `UPDATE concepts
           SET status = 'learning',
               training_stage = 'initial_explanation',
               support_level = 0,
               current_question = ?,
               current_support_content = NULL,
               is_retraining = CASE WHEN status = 'mastered' THEN 1 ELSE 0 END,
               state_version = state_version + 1,
               started_at = COALESCE(started_at, ?),
               completed_at = NULL,
               updated_at = ?
           WHERE id = ? AND state_version = ?`,
        )
        .run(initialQuestion, now, now, conceptId, version);

      if (result.changes === 0) {
        throw new ConcurrentConceptUpdateError();
      }

      return mapConcept(getConceptStatement.get(conceptId) as ConceptRow);
    },

    createPendingAttempt(input: {
      conceptId: string;
      clientRequestId: string;
      kind: AttemptKind;
      question: string;
      userAnswer: string;
      conceptVersion?: number;
    }): PracticeAttempt {
      const id = randomUUID();
      const now = new Date().toISOString();
      const concept = getConceptStatement.get(input.conceptId) as
        | ConceptRow
        | undefined;
      if (!concept) {
        throw new Error("Concept 不存在");
      }
      const conceptVersion = input.conceptVersion ?? concept.state_version;
      db.prepare(
        `INSERT INTO practice_attempts (
          id, concept_id, client_request_id, concept_version, kind, question, user_answer,
          processing_status, assessment, understood_points_json,
          missing_points_json, misconceptions_json, next_question,
          error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, '[]', '[]', '[]', NULL, NULL, ?, ?)`,
      ).run(
        id,
        input.conceptId,
        input.clientRequestId,
        conceptVersion,
        input.kind,
        input.question,
        input.userAnswer,
        now,
        now,
      );

      return mapAttempt(getAttemptStatement.get(id) as AttemptRow);
    },

    getAttemptByClientRequestId(
      clientRequestId: string,
    ): PracticeAttempt | null {
      const row = db
        .prepare("SELECT * FROM practice_attempts WHERE client_request_id = ?")
        .get(clientRequestId) as AttemptRow | undefined;
      return row ? mapAttempt(row) : null;
    },

    getAttemptById(attemptId: string): PracticeAttempt | null {
      const row = getAttemptStatement.get(attemptId) as AttemptRow | undefined;
      return row ? mapAttempt(row) : null;
    },

    retryPendingAttempt(attemptId: string): PracticeAttempt {
      const attempt = getAttemptStatement.get(attemptId) as AttemptRow | undefined;
      if (!attempt) {
        throw new Error("Attempt 不存在");
      }
      const concept = getConceptStatement.get(attempt.concept_id) as
        | ConceptRow
        | undefined;
      if (!concept || concept.state_version !== attempt.concept_version) {
        throw new ConcurrentConceptUpdateError(
          "训练进度已经变化，这次旧回答不能继续重试",
        );
      }
      const result = db
        .prepare(
          `UPDATE practice_attempts
           SET processing_status = 'pending', error_message = NULL, updated_at = ?
           WHERE id = ? AND processing_status = 'failed'`,
        )
        .run(new Date().toISOString(), attemptId);
      if (result.changes === 0) {
        throw new Error("只有失败的 Attempt 可以重试");
      }
      return mapAttempt(getAttemptStatement.get(attemptId) as AttemptRow);
    },

    completeAttemptAndTransition(input: CompleteAttemptInput): PracticeAttempt {
      const complete = db.transaction(() => {
        const attempt = getAttemptStatement.get(input.attemptId) as
          | AttemptRow
          | undefined;
        if (!attempt) {
          throw new Error("Attempt 不存在");
        }
        if (attempt.concept_version !== input.expectedConceptVersion) {
          throw new ConcurrentConceptUpdateError();
        }

        const now = new Date().toISOString();
        const conceptUpdate = db
          .prepare(
            `UPDATE concepts
             SET status = ?,
                 training_stage = ?,
                 support_level = ?,
                 current_question = ?,
                 current_support_content = NULL,
                 state_version = state_version + 1,
                 is_retraining = CASE WHEN ? = 'complete' THEN 0 ELSE is_retraining END,
                 completed_at = CASE WHEN ? = 'complete' THEN ? ELSE NULL END,
                 updated_at = ?
             WHERE id = ? AND state_version = ?`,
          )
          .run(
            input.transition.status,
            input.transition.stage,
            input.transition.supportLevel,
            input.transition.currentQuestion,
            input.transition.stage,
            input.transition.stage,
            now,
            now,
            attempt.concept_id,
            input.expectedConceptVersion,
          );

        if (conceptUpdate.changes === 0) {
          throw new ConcurrentConceptUpdateError();
        }

        const attemptUpdate = db.prepare(
          `UPDATE practice_attempts
           SET processing_status = 'completed',
               assessment = ?,
               understood_points_json = ?,
               missing_points_json = ?,
               misconceptions_json = ?,
               next_question = ?,
               error_message = NULL,
               updated_at = ?
           WHERE id = ? AND processing_status = 'pending'`,
        ).run(
          input.assessment,
          JSON.stringify(input.understoodPoints),
          JSON.stringify(input.missingPoints),
          JSON.stringify(input.misconceptions),
          input.nextQuestion,
          now,
          input.attemptId,
        );
        if (attemptUpdate.changes === 0) {
          throw new ConcurrentConceptUpdateError("这次回答已经被其他请求处理");
        }

        const insertGap = db.prepare(
          `INSERT OR IGNORE INTO knowledge_gaps (
            id, concept_id, gap_type, description, normalized_description,
            status, first_detected_attempt_id, resolved_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?)`,
        );

        const saveGaps = (gapType: GapType, descriptions: string[]) => {
          for (const rawDescription of descriptions) {
            const description = rawDescription.trim().replace(/\s+/g, " ");
            if (!description) {
              continue;
            }
            insertGap.run(
              randomUUID(),
              attempt.concept_id,
              gapType,
              description,
              normalizeGapDescription(description),
              input.attemptId,
              now,
              now,
            );
          }
        };

        saveGaps("missing", input.missingPoints);
        saveGaps("misconception", input.misconceptions);

        if (input.transition.status === "mastered") {
          db.prepare(
            `UPDATE knowledge_gaps
             SET status = 'resolved', resolved_at = ?, updated_at = ?
             WHERE concept_id = ? AND status = 'open'`,
          ).run(now, now, attempt.concept_id);
        }

        return mapAttempt(getAttemptStatement.get(input.attemptId) as AttemptRow);
      });

      return complete();
    },

    failAttempt(attemptId: string, message: string): PracticeAttempt {
      const result = db
        .prepare(
          `UPDATE practice_attempts
           SET processing_status = 'failed', error_message = ?, updated_at = ?
           WHERE id = ? AND processing_status = 'pending'`,
        )
        .run(message, new Date().toISOString(), attemptId);
      if (result.changes === 0) {
        throw new Error("Attempt 不存在");
      }
      return mapAttempt(getAttemptStatement.get(attemptId) as AttemptRow);
    },

    saveSupportAndTransition(input: {
      conceptId: string;
      level: Exclude<SupportLevel, 0>;
      content: string;
      nextQuestion: string;
      stage: "support" | "retest";
      expectedConceptVersion?: number;
    }): Concept {
      const current = getConceptStatement.get(input.conceptId) as
        | ConceptRow
        | undefined;
      if (!current) {
        throw new Error("Concept 不存在");
      }
      const expectedVersion = input.expectedConceptVersion ?? current.state_version;
      const result = db
        .prepare(
          `UPDATE concepts
           SET training_stage = ?, support_level = ?, current_support_content = ?,
               current_question = ?, state_version = state_version + 1,
               updated_at = ?
           WHERE id = ? AND state_version = ? AND status = 'learning'`,
        )
        .run(
          input.stage,
          input.level,
          input.content,
          input.nextQuestion,
          new Date().toISOString(),
          input.conceptId,
          expectedVersion,
        );
      if (result.changes === 0) {
        throw new ConcurrentConceptUpdateError();
      }
      return mapConcept(getConceptStatement.get(input.conceptId) as ConceptRow);
    },

    abandonConcept(conceptId: string, expectedVersion?: number): Concept {
      const current = getConceptStatement.get(conceptId) as ConceptRow | undefined;
      if (!current) {
        throw new Error("Concept 不存在");
      }
      const now = new Date().toISOString();
      const version = expectedVersion ?? current.state_version;
      const result = db
        .prepare(
          `UPDATE concepts
           SET status = 'needs_review', training_stage = 'complete',
               current_question = NULL, is_retraining = 0,
               state_version = state_version + 1,
               completed_at = ?, updated_at = ?
           WHERE id = ? AND status != 'mastered' AND state_version = ?`,
        )
        .run(now, now, conceptId, version);
      if (result.changes === 0) {
        throw new ConcurrentConceptUpdateError();
      }
      return mapConcept(getConceptStatement.get(conceptId) as ConceptRow);
    },

    getTrainingView(conceptId: string): TrainingView | null {
      const conceptRow = getConceptStatement.get(conceptId) as
        | ConceptRow
        | undefined;
      if (!conceptRow) {
        return null;
      }

      const attempts = db
        .prepare(
          "SELECT * FROM practice_attempts WHERE concept_id = ? ORDER BY created_at ASC",
        )
        .all(conceptId) as AttemptRow[];
      const gaps = db
        .prepare(
          `SELECT * FROM knowledge_gaps
           WHERE concept_id = ?
           ORDER BY created_at ASC`,
        )
        .all(conceptId) as GapRow[];

      return {
        concept: mapConcept(conceptRow),
        attempts: attempts.map(mapAttempt),
        openGaps: gaps.filter((gap) => gap.status === "open").map(mapGap),
        resolvedGaps: gaps
          .filter((gap) => gap.status === "resolved")
          .map(mapGap),
      };
    },
  };
}
