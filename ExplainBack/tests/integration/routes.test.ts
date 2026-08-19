import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as createSessionRoute } from "@/app/api/sessions/route";
import { POST as startConceptRoute } from "@/app/api/concepts/[conceptId]/start/route";
import { getDatabase } from "@/server/db/client";
import { createSessionRepository } from "@/server/repositories/session-repository";

const sourceText =
  "RAG 会先检索与问题相关的外部资料，再把检索结果放入模型上下文，让模型基于这些资料生成答案。这样能补充模型训练数据中没有的新知识。".repeat(
    2,
  );

describe("core route handlers", () => {
  let directory: string;
  const originalEnv = { ...process.env };

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "explainback-routes-"));
    process.env.DATABASE_PATH = join(directory, "routes.db");
    process.env.AI_MOCK_MODE = "true";
  });

  beforeEach(() => {
    process.env.AI_MOCK_MODE = "true";
    delete process.env.AI_MOCK_FAILURE;
    getDatabase().prepare("DELETE FROM study_sessions").run();
  });

  afterAll(() => {
    getDatabase().close();
    process.env = originalEnv;
    rmSync(directory, { recursive: true, force: true });
  });

  it("非法 JSON 字段返回 400 和 fieldErrors", async () => {
    const response = await createSessionRoute(
      jsonRequest("http://localhost/api/sessions", {
        title: "A",
        sourceText: "太短",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(body.error.fieldErrors).toMatchObject({
      title: expect.any(Array),
      sourceText: expect.any(Array),
    });
  });

  it("不存在的资源返回 404", async () => {
    const response = await startConceptRoute(
      new Request("http://localhost/api/concepts/missing/start", {
        method: "POST",
      }),
      { params: Promise.resolve({ conceptId: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("AI 配置缺失返回 503，并保留已创建的 Session", async () => {
    process.env.AI_MOCK_MODE = "false";
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;

    const response = await createSessionRoute(
      jsonRequest("http://localhost/api/sessions", {
        clientRequestId: randomUUID(),
        title: "RAG 入门",
        sourceText,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toMatchObject({
      code: "AI_CONFIGURATION",
      resourceId: expect.any(String),
    });
    expect(createSessionRepository(getDatabase()).listRecent(10)[0]).toMatchObject({
      id: body.error.resourceId,
      mapStatus: "failed",
    });
  });

  it("AI Provider 类错误返回 502，不泄露原始错误", async () => {
    process.env.AI_MOCK_FAILURE = "extract";

    const response = await createSessionRoute(
      jsonRequest("http://localhost/api/sessions", {
        clientRequestId: randomUUID(),
        title: "RAG 入门",
        sourceText,
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).toContain("AI_UNAVAILABLE");
    expect(text).not.toContain("mock provider exploded");
  });

  it("成功创建时返回最新 Session View", async () => {
    const response = await createSessionRoute(
      jsonRequest("http://localhost/api/sessions", {
        clientRequestId: randomUUID(),
        title: "RAG 入门",
        sourceText,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      title: "RAG 入门",
      mapStatus: "ready",
      concepts: expect.any(Array),
    });
    expect(body.data.concepts.length).toBeGreaterThan(0);
  });

  it("只提供主题也能创建学习地图", async () => {
    const response = await createSessionRoute(
      jsonRequest("http://localhost/api/sessions", {
        clientRequestId: randomUUID(),
        title: "RAG 入门",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      title: "RAG 入门",
      sourceText: "",
      mapStatus: "ready",
    });
  });
});

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
