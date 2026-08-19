import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiTutor } from "@/server/ai/tutor";
import { createDatabase } from "@/server/db/client";
import { createAnalyticsRepository } from "@/server/repositories/analytics-repository";
import { createSessionRepository } from "@/server/repositories/session-repository";
import {
  createStudySession,
  retryLearningMap,
} from "@/server/services/session-service";

const sourceText =
  "RAG 会先检索与问题相关的外部资料，再把检索结果放入模型上下文，让模型基于这些资料生成答案。这样能补充模型训练数据中没有的新知识。";

describe("session service", () => {
  let directory: string;
  let db: Database.Database;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "explainback-session-service-"));
    db = createDatabase(join(directory, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("在调用 AI 前先保存 Session", async () => {
    const sessions = createSessionRepository(db);
    const extractConcepts = vi.fn<AiTutor["extractConcepts"]>(async () => {
      expect(sessions.listRecent(10)).toHaveLength(1);
      expect(sessions.listRecent(10)[0].mapStatus).toBe("processing");
      return [
        {
          title: "检索增强生成",
          description: "理解检索资料如何参与生成",
          sourceContext: "RAG 会先检索与问题相关的外部资料",
        },
      ];
    });

    const result = await createStudySession(
      { title: "RAG 入门", sourceText, clientRequestId: randomUUID() },
      makeDeps(db, { extractConcepts }),
    );

    expect(result.mapStatus).toBe("ready");
    expect(result.concepts).toHaveLength(1);
    expect(extractConcepts).toHaveBeenCalledOnce();
  });

  it("空资料时接受 AI 生成的通用知识判断基准", async () => {
    const extractConcepts = vi.fn<AiTutor["extractConcepts"]>(async () => [
      {
        title: "RAG 的核心流程",
        description: "理解检索与生成的关系",
        sourceContext: "RAG 通常先检索信息，再将结果用于生成回答。",
      },
    ]);

    const result = await createStudySession(
      {
        clientRequestId: randomUUID(),
        title: "RAG 入门",
        sourceText: "",
      },
      makeDeps(db, { extractConcepts }),
    );

    expect(result).toMatchObject({ mapStatus: "ready", sourceText: "" });
    expect(result.concepts[0].sourceContext).toContain("RAG 通常");
    expect(extractConcepts).toHaveBeenCalledOnce();
  });

  it("资料片段不在原文时自动重试一次", async () => {
    const extractConcepts = vi
      .fn<AiTutor["extractConcepts"]>()
      .mockResolvedValueOnce([
        {
          title: "错误引用",
          description: "资料没有这句话",
          sourceContext: "这段内容并不存在于原资料",
        },
      ])
      .mockResolvedValueOnce([
        {
          title: "检索增强生成",
          description: "理解检索资料如何参与生成",
          sourceContext: "再把检索结果放入模型上下文",
        },
      ]);

    const result = await createStudySession(
      { title: "RAG 入门", sourceText, clientRequestId: randomUUID() },
      makeDeps(db, { extractConcepts }),
    );

    expect(result.mapStatus).toBe("ready");
    expect(extractConcepts).toHaveBeenCalledTimes(2);
  });

  it("AI 连续失败后保留 Session，并复用原 ID 重试", async () => {
    const sessions = createSessionRepository(db);
    const failingExtract = vi
      .fn<AiTutor["extractConcepts"]>()
      .mockRejectedValue(new Error("provider down"));

    await expect(
      createStudySession(
        { title: "RAG 入门", sourceText, clientRequestId: randomUUID() },
        makeDeps(db, { extractConcepts: failingExtract }),
      ),
    ).rejects.toMatchObject({ name: "TutorOperationError" });

    const failed = sessions.listRecent(10)[0];
    expect(failed).toMatchObject({ mapStatus: "failed" });
    expect(
      sessions.getSessionWithConcepts(failed.id)?.sourceText,
    ).toBe(sourceText);

    const recovered = await retryLearningMap(
      failed.id,
      makeDeps(db, {
        extractConcepts: vi.fn(async () => [
          {
            title: "检索增强生成",
            description: "理解检索资料如何参与生成",
            sourceContext: "再把检索结果放入模型上下文",
          },
        ]),
      }),
    );

    expect(recovered).toMatchObject({ id: failed.id, mapStatus: "ready" });
  });

  it("空资料生成失败后复用原 Session 恢复", async () => {
    const sessions = createSessionRepository(db);
    const failingExtract = vi
      .fn<AiTutor["extractConcepts"]>()
      .mockRejectedValue(new Error("provider down"));

    await expect(
      createStudySession(
        {
          title: "RAG 入门",
          sourceText: "",
          clientRequestId: randomUUID(),
        },
        makeDeps(db, { extractConcepts: failingExtract }),
      ),
    ).rejects.toMatchObject({ name: "TutorOperationError" });

    const failed = sessions.listRecent(10)[0];
    expect(failed).toMatchObject({ mapStatus: "failed" });
    expect(sessions.getSessionWithConcepts(failed.id)?.sourceText).toBe("");

    const recovered = await retryLearningMap(
      failed.id,
      makeDeps(db, {
        extractConcepts: vi.fn(async () => [
          {
            title: "RAG 的核心流程",
            description: "理解检索与生成的关系",
            sourceContext: "RAG 通常先检索信息，再将结果用于生成回答。",
          },
        ]),
      }),
    );

    expect(recovered).toMatchObject({
      id: failed.id,
      mapStatus: "ready",
      sourceText: "",
    });
  });

  it("重复创建请求复用同一个 Session 且不重复调用 AI", async () => {
    const clientRequestId = randomUUID();
    const extractConcepts = vi.fn<AiTutor["extractConcepts"]>(async () => [
      {
        title: "检索增强生成",
        description: "理解检索资料如何参与生成",
        sourceContext: "再把检索结果放入模型上下文",
      },
    ]);
    const deps = makeDeps(db, { extractConcepts });
    const input = { title: "RAG 入门", sourceText, clientRequestId };

    const first = await createStudySession(input, deps);
    const duplicate = await createStudySession(input, deps);

    expect(duplicate.id).toBe(first.id);
    expect(extractConcepts).toHaveBeenCalledOnce();
    expect(createSessionRepository(db).listRecent(10)).toHaveLength(1);
  });

  it("只允许失败的 Session 重新生成学习地图", async () => {
    const ready = await createStudySession(
      { title: "RAG 入门", sourceText, clientRequestId: randomUUID() },
      makeDeps(db, {
        extractConcepts: vi.fn(async () => [
          {
            title: "检索增强生成",
            description: "理解检索资料如何参与生成",
            sourceContext: "再把检索结果放入模型上下文",
          },
        ]),
      }),
    );

    await expect(
      retryLearningMap(ready.id, makeDeps(db, {})),
    ).rejects.toMatchObject({ name: "InvalidStateError" });
  });
});

function makeDeps(
  db: Database.Database,
  tutorOverrides: Partial<AiTutor>,
) {
  const tutor: AiTutor = {
    extractConcepts: async () => [],
    assessAnswer: async () => {
      throw new Error("not used");
    },
    generateSupport: async () => {
      throw new Error("not used");
    },
    ...tutorOverrides,
  };

  return {
    sessions: createSessionRepository(db),
    analytics: createAnalyticsRepository(db),
    tutor,
    runInTransaction: <T,>(operation: () => T) => db.transaction(operation)(),
  };
}
