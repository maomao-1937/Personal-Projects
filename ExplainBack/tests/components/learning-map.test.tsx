import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  LearningMap,
  type LearningMapSession,
} from "@/components/learning-map";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("LearningMap", () => {
  it("显示四种知识点状态和可访问链接", () => {
    render(<LearningMap session={readySession()} />);

    expect(screen.getByText("未开始")).toBeInTheDocument();
    expect(screen.getByText("学习中")).toBeInTheDocument();
    expect(screen.getByText("需复习")).toBeInTheDocument();
    expect(screen.getByText("已掌握")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /开始 检索/ })).toHaveAttribute(
      "href",
      "/sessions/session-1/concepts/concept-1",
    );
  });

  it("地图失败时显示原地重试入口", () => {
    render(
      <LearningMap
        session={{ ...readySession(), mapStatus: "failed", mapError: "生成失败" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("生成失败");
    expect(screen.getByRole("button", { name: "重新生成学习地图" })).toBeEnabled();
  });
});

function readySession(): LearningMapSession {
  const statuses = [
    "not_started",
    "learning",
    "needs_review",
    "mastered",
  ] as const;
  return {
    id: "session-1",
    clientRequestId: "6a9b6f94-bfcf-45ea-8ca8-f215b8477c1f",
    title: "RAG 入门",
    mapStatus: "ready",
    mapError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    concepts: statuses.map((status, index) => ({
      id: `concept-${index + 1}`,
      sessionId: "session-1",
      title: ["检索", "上下文", "误解", "验证"][index],
      description: "理解核心关系",
      sourceContext: "资料原文",
      status,
      trainingStage: status === "mastered" ? "complete" : "initial_explanation",
      supportLevel: 0,
      currentQuestion: null,
      currentSupportContent: null,
      stateVersion: 0,
      isRetraining: false,
      sortOrder: index,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };
}
