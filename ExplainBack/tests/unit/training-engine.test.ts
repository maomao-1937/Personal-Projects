import { describe, expect, it } from "vitest";

import {
  getAttemptKind,
  transitionAfterAssessment,
  transitionAfterSupport,
} from "@/server/training/engine";
import {
  createSessionInputSchema,
  submitAttemptInputSchema,
} from "@/lib/validation";

describe("transitionAfterAssessment", () => {
  it("首次回答正确时进入验证追问而不是直接掌握", () => {
    expect(
      transitionAfterAssessment({
        stage: "initial_explanation",
        status: "learning",
        supportLevel: 0,
        assessment: "correct",
        nextQuestion: "外部资料如何参与生成？",
      }),
    ).toMatchObject({
      stage: "validation_probe",
      status: "learning",
      mastered: false,
    });
  });

  it("验证追问正确后掌握", () => {
    expect(
      transitionAfterAssessment({
        stage: "validation_probe",
        status: "learning",
        supportLevel: 0,
        assessment: "correct",
        nextQuestion: "ignored",
      }),
    ).toMatchObject({
      stage: "complete",
      status: "mastered",
      mastered: true,
      supportLevel: 0,
      currentQuestion: null,
    });
  });

  it("验证追问未通过时进入针对性追问", () => {
    expect(
      transitionAfterAssessment({
        stage: "validation_probe",
        status: "learning",
        supportLevel: 0,
        assessment: "partial",
        nextQuestion: "检索结果如何进入生成上下文？",
      }),
    ).toMatchObject({
      stage: "targeted_probe",
      status: "learning",
      currentQuestion: "检索结果如何进入生成上下文？",
    });
  });

  it("Level 3 后重测失败时标记需复习", () => {
    expect(
      transitionAfterAssessment({
        stage: "retest",
        status: "learning",
        supportLevel: 3,
        assessment: "partial",
        nextQuestion: "再解释一次。",
      }),
    ).toMatchObject({
      stage: "complete",
      status: "needs_review",
      mastered: false,
      currentQuestion: null,
    });
  });

  it("重测正确时掌握", () => {
    expect(
      transitionAfterAssessment({
        stage: "retest",
        status: "learning",
        supportLevel: 3,
        assessment: "correct",
        nextQuestion: "ignored",
      }),
    ).toMatchObject({
      stage: "complete",
      status: "mastered",
      mastered: true,
    });
  });

  it("unclear 不改变当前状态，但允许 AI 换一种澄清问法", () => {
    expect(
      transitionAfterAssessment({
        stage: "targeted_probe",
        status: "learning",
        supportLevel: 0,
        assessment: "unclear",
        nextQuestion: "请再具体一点。",
      }),
    ).toEqual({
      stage: "targeted_probe",
      status: "learning",
      supportLevel: 0,
      mastered: false,
      currentQuestion: "请再具体一点。",
    });
  });
});

describe("transitionAfterSupport", () => {
  it.each([1, 2] as const)("Level %s 保持支持阶段", (level) => {
    expect(
      transitionAfterSupport({
        currentLevel: level - 1 as 0 | 1,
        requestedLevel: level,
        nextQuestion: "结合提示再想一次。",
      }),
    ).toEqual({
      stage: "support",
      supportLevel: level,
      currentQuestion: "结合提示再想一次。",
    });
  });

  it("Level 3 后强制进入重测", () => {
    expect(
      transitionAfterSupport({
        currentLevel: 2,
        requestedLevel: 3,
        nextQuestion: "现在请重新完整解释这个概念。",
      }),
    ).toEqual({
      stage: "retest",
      supportLevel: 3,
      currentQuestion: "现在请重新完整解释这个概念。",
    });
  });

  it("拒绝跳级请求", () => {
    expect(() =>
      transitionAfterSupport({
        currentLevel: 0,
        requestedLevel: 2,
        nextQuestion: "跳级",
      }),
    ).toThrowError("支持等级必须逐级增加");
  });
});

describe("getAttemptKind", () => {
  it("按训练阶段映射回答类型", () => {
    expect(getAttemptKind("initial_explanation")).toBe("explanation");
    expect(getAttemptKind("validation_probe")).toBe("followup");
    expect(getAttemptKind("targeted_probe")).toBe("followup");
    expect(getAttemptKind("support")).toBe("followup");
    expect(getAttemptKind("retest")).toBe("retest");
  });

  it("完成态不能再创建回答", () => {
    expect(() => getAttemptKind("complete")).toThrowError(
      "完成态不能提交回答",
    );
  });
});

describe("HTTP input schemas", () => {
  it("修剪创建 Session 的输入", () => {
    const parsed = createSessionInputSchema.parse({
      clientRequestId: "6a9b6f94-bfcf-45ea-8ca8-f215b8477c1f",
      title: "  RAG 基础  ",
      sourceText: `  ${"RAG 会先检索资料，再把资料放入上下文辅助生成。".repeat(5)}  `,
    });

    expect(parsed.title).toBe("RAG 基础");
    expect(parsed.sourceText.startsWith("RAG")).toBe(true);
  });

  it("拒绝过短资料和非 UUID 请求编号", () => {
    expect(
      createSessionInputSchema.safeParse({ title: "RAG", sourceText: "太短" })
        .success,
    ).toBe(false);
    expect(
      submitAttemptInputSchema.safeParse({
        clientRequestId: "not-a-uuid",
        userAnswer: "这是我的解释",
      }).success,
    ).toBe(false);
  });
});
