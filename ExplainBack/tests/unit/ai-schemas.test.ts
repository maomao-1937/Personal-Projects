import { describe, expect, it } from "vitest";

import {
  assessmentSchema,
  conceptExtractionSchema,
  sourceContainsContext,
  supportSchema,
} from "@/server/ai/schemas";
import {
  buildAssessmentPrompt,
  buildExtractionPrompt,
  buildSupportPrompt,
  getAssessmentSystemPrompt,
  getExtractionSystemPrompt,
  getSupportSystemPrompt,
} from "@/server/ai/prompts";

describe("AI output schemas", () => {
  it("接受 1～10 个有资料原文的知识点", () => {
    expect(
      conceptExtractionSchema.parse({
        concepts: [
          {
            title: "检索",
            description: "理解如何找到相关资料",
            source_context: "先检索相关资料",
          },
        ],
      }).concepts,
    ).toHaveLength(1);
  });

  it("拒绝非法判断枚举和一次提出多个问题", () => {
    expect(
      assessmentSchema.safeParse({
        assessment: "mostly-right",
        understood_points: [],
        missing_points: [],
        misconceptions: [],
        next_question: "为什么？然后呢？",
      }).success,
    ).toBe(false);

    expect(
      assessmentSchema.safeParse({
        assessment: "partial",
        understood_points: [],
        missing_points: ["缺少生成关系"],
        misconceptions: [],
        next_question: "为什么？然后呢？",
      }).success,
    ).toBe(false);
  });

  it("拒绝 correct 同时携带遗漏或误解", () => {
    expect(
      assessmentSchema.safeParse({
        assessment: "correct",
        understood_points: ["已解释检索和生成"],
        missing_points: ["仍有遗漏"],
        misconceptions: [],
        next_question: "换一个场景还成立吗？",
      }).success,
    ).toBe(false);
  });

  it("拒绝错误支持等级和超过 120 字的 Level 3 内容", () => {
    const base = {
      content: "想想外部资料进入上下文以后发生了什么。",
      next_question: "外部资料怎样影响最终答案？",
    };

    expect(supportSchema.safeParse({ ...base, level: 0 }).success).toBe(false);
    expect(
      supportSchema.safeParse({
        ...base,
        level: 3,
        content: "这".repeat(121),
      }).success,
    ).toBe(false);
  });
});

describe("sourceContainsContext", () => {
  it("忽略空白差异，但不接受资料中不存在的概括", () => {
    const source = "RAG 会先检索资料，\n\n再把资料放入上下文辅助生成。";

    expect(
      sourceContainsContext(source, "先检索资料， 再把资料放入上下文"),
    ).toBe(true);
    expect(sourceContainsContext(source, "RAG 能保证答案永远正确")).toBe(false);
  });
});

describe("dual-mode prompts", () => {
  it("资料约束模式禁止补充外部事实", () => {
    expect(getExtractionSystemPrompt("source_bound")).toContain(
      "不补充外部事实",
    );
    expect(getAssessmentSystemPrompt("source_bound")).toContain(
      "仅依据 <source>",
    );
  });

  it("主题直练模式允许通用知识但保留不确定性", () => {
    expect(getExtractionSystemPrompt("topic_general")).toContain("通用知识");
    expect(getAssessmentSystemPrompt("topic_general")).toContain("unclear");
    expect(getSupportSystemPrompt("topic_general")).toContain("争议");
    expect(buildExtractionPrompt({ title: "RAG", sourceText: "" })).toContain(
      "<topic>RAG</topic>",
    );
  });

  it("主题直练的判断和支持使用生成的判断基准", () => {
    const input = {
      conceptTitle: "RAG 的核心流程",
      sourceText: "",
      sourceContext: "RAG 通常先检索信息，再用于生成回答。",
      question: "RAG 如何工作？",
      userAnswer: "先找资料再回答。",
      stage: "initial_explanation" as const,
    };

    expect(buildAssessmentPrompt(input)).toContain("<reference>");
    expect(buildAssessmentPrompt(input)).not.toContain("<source>");
    expect(buildSupportPrompt({ ...input, level: 1 })).toContain("<reference>");
  });
});
