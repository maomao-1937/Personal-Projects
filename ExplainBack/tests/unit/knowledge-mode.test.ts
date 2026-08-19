import { describe, expect, it } from "vitest";

import { getKnowledgeMode } from "@/lib/knowledge-mode";
import { createSessionInputSchema } from "@/lib/validation";

const requestId = "6a9b6f94-bfcf-45ea-8ca8-f215b8477c1f";

describe("knowledge mode", () => {
  it("空资料进入主题直练模式", () => {
    expect(getKnowledgeMode("")).toBe("topic_general");
    expect(getKnowledgeMode("   \n")).toBe("topic_general");
  });

  it("有资料进入资料约束模式", () => {
    expect(getKnowledgeMode("RAG 会检索资料")).toBe("source_bound");
  });
});

describe("optional source validation", () => {
  it("接受缺省或空资料", () => {
    expect(
      createSessionInputSchema.parse({
        clientRequestId: requestId,
        title: "RAG 入门",
      }).sourceText,
    ).toBe("");
    expect(
      createSessionInputSchema.parse({
        clientRequestId: requestId,
        title: "RAG 入门",
        sourceText: "   ",
      }).sourceText,
    ).toBe("");
  });

  it("拒绝非空但少于 100 字的资料", () => {
    expect(
      createSessionInputSchema.safeParse({
        clientRequestId: requestId,
        title: "RAG 入门",
        sourceText: "RAG 是一种方法。",
      }).success,
    ).toBe(false);
  });
});
