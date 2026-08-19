import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabase } from "@/server/db/client";
import { createSessionRepository } from "@/server/repositories/session-repository";
import { createTrainingRepository } from "@/server/repositories/training-repository";

const source =
  "RAG 会先从外部知识库检索与问题相关的资料，再把检索结果放入模型上下文，让模型基于资料生成答案。".repeat(
    4,
  );

describe("SQLite repositories", () => {
  let directory: string;
  let db: Database.Database;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "explainback-"));
    db = createDatabase(join(directory, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("运行版本化迁移并启用外键", () => {
    const migrationCount = db
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };
    const foreignKeys = db.pragma("foreign_keys", { simple: true });

    expect(migrationCount.count).toBeGreaterThan(0);
    expect(foreignKeys).toBe(1);
  });

  it("持久化 Session 和按顺序排列的 Concepts", () => {
    const sessions = createSessionRepository(db);
    const session = sessions.createProcessing({
      title: "RAG 入门",
      sourceText: source,
    });

    expect(session.mapStatus).toBe("processing");

    const concepts = sessions.replaceConceptsAndMarkReady(session.id, [
      {
        title: "检索",
        description: "找到相关资料",
        sourceContext: "RAG 会先从外部知识库检索与问题相关的资料",
      },
      {
        title: "增强生成",
        description: "把资料用于生成",
        sourceContext: "再把检索结果放入模型上下文",
      },
    ]);

    expect(concepts.map((concept) => concept.sortOrder)).toEqual([0, 1]);

    const view = sessions.getSessionWithConcepts(session.id);
    expect(view?.mapStatus).toBe("ready");
    expect(view?.concepts.map((concept) => concept.title)).toEqual([
      "检索",
      "增强生成",
    ]);
    expect(sessions.listRecent(10)[0]).toMatchObject({
      id: session.id,
      conceptCount: 2,
      masteredCount: 0,
    });
  });

  it("地图失败后保留原始资料，并能复用同一 Session 重试", () => {
    const sessions = createSessionRepository(db);
    const session = sessions.createProcessing({ title: "RAG", sourceText: source });

    sessions.markMapFailed(session.id, "知识地图生成失败，请重试");
    expect(sessions.getSessionWithConcepts(session.id)).toMatchObject({
      sourceText: source,
      mapStatus: "failed",
      mapError: "知识地图生成失败，请重试",
    });

    sessions.replaceConceptsAndMarkReady(session.id, [
      {
        title: "检索",
        description: "找到相关资料",
        sourceContext: "RAG 会先从外部知识库检索与问题相关的资料",
      },
    ]);

    expect(sessions.getSessionWithConcepts(session.id)).toMatchObject({
      id: session.id,
      mapStatus: "ready",
      mapError: null,
    });
  });

  it("保留失败回答，并以 clientRequestId 支持幂等查询", () => {
    const { conceptId } = seedConcept(db);
    const training = createTrainingRepository(db);
    const clientRequestId = randomUUID();

    training.startConcept(conceptId, "请用自己的话解释为什么需要 RAG？");
    const attempt = training.createPendingAttempt({
      conceptId,
      clientRequestId,
      kind: "explanation",
      question: "请用自己的话解释为什么需要 RAG？",
      userAnswer: "RAG 就是先搜索资料。",
    });

    expect(attempt.processingStatus).toBe("pending");
    training.failAttempt(attempt.id, "AI 服务暂时不可用");

    expect(training.getAttemptByClientRequestId(clientRequestId)).toMatchObject({
      id: attempt.id,
      userAnswer: "RAG 就是先搜索资料。",
      processingStatus: "failed",
      errorMessage: "AI 服务暂时不可用",
    });
  });

  it("在同一事务中完成回答、推进状态并去重知识漏洞", () => {
    const { conceptId } = seedConcept(db);
    const training = createTrainingRepository(db);
    training.startConcept(conceptId, "为什么需要 RAG？");

    const firstAttempt = training.createPendingAttempt({
      conceptId,
      clientRequestId: randomUUID(),
      kind: "explanation",
      question: "为什么需要 RAG？",
      userAnswer: "因为需要搜索。",
    });

    training.completeAttemptAndTransition({
      attemptId: firstAttempt.id,
      expectedConceptVersion: firstAttempt.conceptVersion,
      assessment: "partial",
      understoodPoints: ["知道需要检索"],
      missingPoints: ["没有解释检索资料如何参与生成"],
      misconceptions: ["  认为 RAG 会训练一个新模型  "],
      nextQuestion: "检索到的资料怎样影响最终答案？",
      transition: {
        stage: "targeted_probe",
        status: "learning",
        supportLevel: 0,
        currentQuestion: "检索到的资料怎样影响最终答案？",
      },
    });

    const secondAttempt = training.createPendingAttempt({
      conceptId,
      clientRequestId: randomUUID(),
      kind: "followup",
      question: "检索到的资料怎样影响最终答案？",
      userAnswer: "还不清楚。",
    });

    training.completeAttemptAndTransition({
      attemptId: secondAttempt.id,
      expectedConceptVersion: secondAttempt.conceptVersion,
      assessment: "incorrect",
      understoodPoints: [],
      missingPoints: ["  没有解释检索资料如何参与生成  "],
      misconceptions: ["认为 RAG 会训练一个新模型"],
      nextQuestion: "再想想上下文的作用。",
      transition: {
        stage: "targeted_probe",
        status: "learning",
        supportLevel: 0,
        currentQuestion: "再想想上下文的作用。",
      },
    });

    const view = training.getTrainingView(conceptId);
    expect(view?.attempts).toHaveLength(2);
    expect(view?.attempts[0]).toMatchObject({
      processingStatus: "completed",
      assessment: "partial",
      understoodPoints: ["知道需要检索"],
    });
    expect(view?.openGaps).toHaveLength(2);
    expect(view?.concept).toMatchObject({
      trainingStage: "targeted_probe",
      currentQuestion: "再想想上下文的作用。",
    });
  });

  it("持久化支持内容，并在 Level 3 后恢复重测问题", () => {
    const { conceptId } = seedConcept(db);
    const training = createTrainingRepository(db);

    training.startConcept(conceptId, "为什么需要 RAG？");
    training.saveSupportAndTransition({
      conceptId,
      level: 3,
      content: "RAG 把检索到的资料加入上下文，再基于它生成。",
      nextQuestion: "请重新完整解释 RAG 如何使用外部资料。",
      stage: "retest",
    });

    expect(training.getTrainingView(conceptId)?.concept).toMatchObject({
      supportLevel: 3,
      currentSupportContent: "RAG 把检索到的资料加入上下文，再基于它生成。",
      currentQuestion: "请重新完整解释 RAG 如何使用外部资料。",
      trainingStage: "retest",
    });
  });
});

function seedConcept(db: Database.Database) {
  const sessions = createSessionRepository(db);
  const session = sessions.createProcessing({ title: "RAG", sourceText: source });
  const [concept] = sessions.replaceConceptsAndMarkReady(session.id, [
    {
      title: "RAG 的作用",
      description: "理解检索如何增强生成",
      sourceContext:
        "RAG 会先从外部知识库检索与问题相关的资料，再把检索结果放入模型上下文",
    },
  ]);

  return { sessionId: session.id, conceptId: concept.id };
}
