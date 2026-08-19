import { describe, expect, it } from "vitest";

import { createMockTutor } from "@/server/ai/mock-tutor";
import { sourceContainsContext } from "@/server/ai/schemas";

const sourceText =
  "RAG 会先检索与问题相关的外部资料，再把检索结果放入模型上下文，让模型基于这些资料生成答案。这样能补充模型训练数据中没有的新知识。";

const baseAssessmentInput = {
  conceptTitle: "RAG 的作用",
  sourceText,
  sourceContext: sourceText,
  question: "请解释 RAG 如何使用外部资料。",
  stage: "initial_explanation" as const,
};

describe("mock tutor", () => {
  it("空资料时根据主题生成带判断基准的知识点", async () => {
    const result = await createMockTutor().extractConcepts({
      title: "RAG 入门",
      sourceText: "",
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      title: expect.stringContaining("RAG"),
      sourceContext: expect.any(String),
    });
    expect(result[0].sourceContext.length).toBeGreaterThan(0);
  });

  it("提取的 sourceContext 都来自原资料", async () => {
    const result = await createMockTutor().extractConcepts({
      title: "RAG 入门",
      sourceText,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every((concept) =>
        sourceContainsContext(sourceText, concept.sourceContext),
      ),
    ).toBe(true);
  });

  it.each([
    [
      "先检索外部资料，再把资料放进上下文，让模型基于资料生成答案。",
      "correct",
    ],
    ["RAG 就是搜索资料。", "partial"],
    ["RAG 是把新知识重新训练进模型参数。", "incorrect"],
  ] as const)("稳定判断示例回答：%s", async (userAnswer, expected) => {
    const result = await createMockTutor().assessAnswer({
      ...baseAssessmentInput,
      userAnswer,
    });

    expect(result.assessment).toBe(expected);
  });

  it("按等级生成一个问题，Level 3 内容不超过 120 字", async () => {
    const tutor = createMockTutor();

    for (const level of [1, 2, 3] as const) {
      const result = await tutor.generateSupport({
        ...baseAssessmentInput,
        userAnswer: "RAG 就是搜索资料。",
        level,
      });

      expect(result.level).toBe(level);
      expect((result.nextQuestion.match(/[？?]/g) ?? []).length).toBeLessThanOrEqual(
        1,
      );
      if (level === 3) {
        expect(result.content.length).toBeLessThanOrEqual(120);
      }
    }
  });
});
