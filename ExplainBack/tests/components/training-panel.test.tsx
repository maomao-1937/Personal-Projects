import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TrainingPanel,
  type TrainingPanelTraining,
} from "@/components/training-panel";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("TrainingPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
    refresh.mockReset();
  });

  it("首屏一次只显示一个当前问题", () => {
    renderPanel(baseTraining());

    expect(screen.getByRole("heading", { name: "为什么需要 RAG？" })).toBeInTheDocument();
    expect(screen.getAllByTestId("current-question")).toHaveLength(1);
  });

  it("提交 partial 后显示理解点、遗漏和针对性追问", async () => {
    const next = baseTraining({
      concept: {
        trainingStage: "targeted_probe",
        currentQuestion: "检索到的资料怎样影响最终答案？",
      },
      attempts: [completedAttempt()],
      openGaps: [gap("missing", "没有解释资料如何参与生成")],
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ data: { attempt: completedAttempt(), training: next } }),
    );
    renderPanel(baseTraining());

    await userEvent.type(screen.getByLabelText("你的解释"), "RAG 就是搜索资料。");
    await userEvent.click(screen.getByRole("button", { name: "提交解释" }));

    expect(await screen.findByText("已经理解")).toBeInTheDocument();
    expect(screen.getByText("知道需要检索")).toBeInTheDocument();
    expect(screen.getByText("还需想清楚")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "检索到的资料怎样影响最终答案？" }),
    ).toBeInTheDocument();
  });

  it("请求支持后更新内容和下一等级按钮", async () => {
    const initial = baseTraining({
      concept: {
        trainingStage: "targeted_probe",
        currentQuestion: "资料怎样参与生成？",
      },
      attempts: [completedAttempt()],
    });
    const supported = baseTraining({
      concept: {
        trainingStage: "support",
        supportLevel: 1,
        currentQuestion: "检索到资料后会放到哪里？",
        currentSupportContent: "想一想模型回答前能先做什么。",
      },
      attempts: [completedAttempt()],
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ data: supported }),
    );
    renderPanel(initial);

    await userEvent.click(screen.getByRole("button", { name: /Level 1/ }));

    expect(await screen.findByText("想一想模型回答前能先做什么。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Level 2/ })).toBeEnabled();
  });

  it("Retest 明确要求重新完整解释", () => {
    renderPanel(
      baseTraining({
        concept: {
          trainingStage: "retest",
          supportLevel: 3,
          currentQuestion: "请重新完整解释 RAG。",
        },
      }),
    );

    expect(screen.getByText("现在请重新完整解释")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交重新解释" })).toBeEnabled();
  });

  it("Mastered 显示已修复漏洞和下一个知识点", () => {
    renderPanel(
      baseTraining({
        concept: {
          status: "mastered",
          trainingStage: "complete",
          currentQuestion: null,
        },
        attempts: [completedAttempt({ assessment: "correct" })],
        resolvedGaps: [gap("missing", "没有解释资料如何参与生成", "resolved")],
      }),
    );

    expect(screen.getByRole("heading", { name: "这个知识点已经讲明白了" })).toBeInTheDocument();
    expect(screen.getByText("没有解释资料如何参与生成")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /继续学习 上下文/ })).toHaveAttribute(
      "href",
      "/sessions/session-1/concepts/concept-2",
    );
  });

  it("API 失败时保留回答并提供原 Attempt 重试", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "AI_UNAVAILABLE",
            message: "AI 暂时没有完成判断，你的回答已保存",
            resourceId: "attempt-failed",
          },
        },
        { status: 502 },
      ),
    );
    renderPanel(baseTraining());
    const answer = "RAG 就是搜索资料。";

    await userEvent.type(screen.getByLabelText("你的解释"), answer);
    await userEvent.click(screen.getByRole("button", { name: "提交解释" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("回答已保存");
    expect(screen.getByLabelText("你的解释")).toHaveValue(answer);
    expect(screen.getByRole("button", { name: "重试这次判断" })).toBeEnabled();
  });

  it("刷新后从失败 Attempt 恢复原回答和重试入口", () => {
    renderPanel(
      baseTraining({
        attempts: [
          completedAttempt({
            id: "attempt-failed",
            clientRequestId: "6165f24e-34d6-4e90-a4f7-89d30a3103a1",
            processingStatus: "failed",
            assessment: null,
            errorMessage: "AI 判断失败，请重试",
          }),
        ],
      }),
    );

    expect(screen.getByLabelText("你的解释")).toHaveValue("RAG 就是搜索资料。");
    expect(screen.getByRole("alert")).toHaveTextContent("AI 判断失败，请重试");
    expect(screen.getByRole("button", { name: "重试这次判断" })).toBeEnabled();
  });

  it("训练已推进后不再恢复过期的失败回答", () => {
    renderPanel(
      baseTraining({
        concept: { stateVersion: 2 },
        attempts: [
          completedAttempt({
            id: "attempt-failed",
            conceptVersion: 1,
            processingStatus: "failed",
            assessment: null,
            errorMessage: "AI 判断失败，请重试",
          }),
          completedAttempt({ id: "attempt-new", conceptVersion: 1 }),
        ],
      }),
    );

    expect(screen.getByLabelText("你的解释")).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "重试这次判断" }),
    ).not.toBeInTheDocument();
  });

  it("已掌握结果页可以重新训练当前知识点", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ data: baseTraining() }),
    );
    renderPanel(
      baseTraining({
        concept: {
          status: "mastered",
          trainingStage: "complete",
          currentQuestion: null,
        },
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "重新训练本知识点" }));

    expect(
      await screen.findByRole("heading", { name: "为什么需要 RAG？" }),
    ).toBeInTheDocument();
  });
});

function renderPanel(training: TrainingPanelTraining) {
  return render(
    <TrainingPanel
      initialTraining={training}
      session={{ id: "session-1", title: "RAG 入门" }}
      nextConcept={{ id: "concept-2", title: "上下文" }}
    />,
  );
}

function baseTraining(
  overrides: {
    concept?: Partial<TrainingPanelTraining["concept"]>;
    attempts?: TrainingPanelTraining["attempts"];
    openGaps?: TrainingPanelTraining["openGaps"];
    resolvedGaps?: TrainingPanelTraining["resolvedGaps"];
  } = {},
): TrainingPanelTraining {
  const now = new Date().toISOString();
  return {
    concept: {
      id: "concept-1",
      sessionId: "session-1",
      title: "RAG 的作用",
      description: "理解检索如何增强生成",
      sourceContext: "资料原文",
      status: "learning",
      trainingStage: "initial_explanation",
      supportLevel: 0,
      currentQuestion: "为什么需要 RAG？",
      currentSupportContent: null,
      stateVersion: 1,
      isRetraining: false,
      sortOrder: 0,
      startedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      ...overrides.concept,
    },
    attempts: overrides.attempts ?? [],
    openGaps: overrides.openGaps ?? [],
    resolvedGaps: overrides.resolvedGaps ?? [],
  };
}

function completedAttempt(
  overrides: Partial<TrainingPanelTraining["attempts"][number]> = {},
): TrainingPanelTraining["attempts"][number] {
  const now = new Date().toISOString();
  return {
    id: "attempt-1",
    conceptId: "concept-1",
    clientRequestId: "request-1",
    conceptVersion: 1,
    kind: "explanation",
    question: "为什么需要 RAG？",
    userAnswer: "RAG 就是搜索资料。",
    processingStatus: "completed",
    assessment: "partial",
    understoodPoints: ["知道需要检索"],
    missingPoints: ["没有解释资料如何参与生成"],
    misconceptions: [],
    nextQuestion: "检索到的资料怎样影响最终答案？",
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function gap(
  gapType: "missing" | "misconception",
  description: string,
  status: "open" | "resolved" = "open",
): TrainingPanelTraining["openGaps"][number] {
  const now = new Date().toISOString();
  return {
    id: `gap-${status}`,
    conceptId: "concept-1",
    gapType,
    description,
    status,
    firstDetectedAttemptId: "attempt-1",
    resolvedAt: status === "resolved" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
}
