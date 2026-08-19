import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMockTutor } from "@/server/ai/mock-tutor";
import { createDatabase } from "@/server/db/client";
import { createAnalyticsRepository } from "@/server/repositories/analytics-repository";
import { createSessionRepository } from "@/server/repositories/session-repository";
import { createTrainingRepository } from "@/server/repositories/training-repository";
import { createStudySession } from "@/server/services/session-service";
import {
  requestSupport,
  startTraining,
  submitAttempt,
} from "@/server/services/training-service";

const sourceText =
  "RAG 会先检索与问题相关的外部资料，再把检索结果放入模型上下文，让模型基于这些资料生成答案。这样能补充模型训练数据中没有的新知识。".repeat(
    2,
  );

describe("analytics events", () => {
  let directory: string;
  let db: Database.Database;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "explainback-analytics-"));
    db = createDatabase(join(directory, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("完整训练流程只记录白名单事件", async () => {
    const tutor = createMockTutor();
    const sessions = createSessionRepository(db);
    const analytics = createAnalyticsRepository(db);
    const shared = {
      sessions,
      analytics,
      tutor,
      runInTransaction: transactionRunner(db),
    };
    const session = await createStudySession(
      { title: "RAG 入门", sourceText, clientRequestId: randomUUID() },
      shared,
    );
    const conceptId = session.concepts[0].id;
    const trainingDeps = {
      ...shared,
      training: createTrainingRepository(db),
    };

    await startTraining(conceptId, trainingDeps);
    await submitAttempt(
      conceptId,
      { clientRequestId: randomUUID(), userAnswer: "RAG 就是搜索资料。" },
      trainingDeps,
    );
    await requestSupport(conceptId, trainingDeps);
    await requestSupport(conceptId, trainingDeps);
    await requestSupport(conceptId, trainingDeps);
    await submitAttempt(
      conceptId,
      {
        clientRequestId: randomUUID(),
        userAnswer:
          "先检索外部资料，再把资料放进上下文，让模型基于资料生成答案。",
      },
      trainingDeps,
    );

    const eventNames = analytics
      .listForSession(session.id)
      .map((event) => event.eventName);
    expect(eventNames).toEqual(
      expect.arrayContaining([
        "session_created",
        "concept_started",
        "explanation_submitted",
        "hint_requested",
        "concept_mastered",
      ]),
    );
    expect(
      eventNames.every((name) =>
        [
          "session_created",
          "concept_started",
          "explanation_submitted",
          "followup_answered",
          "hint_requested",
          "concept_mastered",
          "concept_abandoned",
        ].includes(name),
      ),
    ).toBe(true);
  });

  it("埋点写入失败时回滚同一事务内的 Session", async () => {
    const sessions = createSessionRepository(db);
    const analytics = createAnalyticsRepository(db);

    await expect(
      createStudySession(
        { title: "RAG 入门", sourceText, clientRequestId: randomUUID() },
        {
          sessions,
          tutor: createMockTutor(),
          analytics: {
            ...analytics,
            record: () => {
              throw new Error("analytics unavailable");
            },
          },
          runInTransaction: transactionRunner(db),
        },
      ),
    ).rejects.toThrow("analytics unavailable");

    expect(sessions.listRecent(10)).toHaveLength(0);
  });
});

function transactionRunner(db: Database.Database) {
  return <T,>(operation: () => T): T => db.transaction(operation)();
}
