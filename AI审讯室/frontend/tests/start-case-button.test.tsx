import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gameApi } from "@/features/game/api";
import { StartCaseButton } from "@/features/game/components/start-case-button";
import type { GameSession, PublicCase } from "@/features/game/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("StartCaseButton", () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("announces generation and opens the generated case instead of CASE-001", async () => {
    vi.spyOn(gameApi, "generateCase").mockResolvedValue({
      caseId: "case_new_001",
    } as PublicCase);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_new_001",
      caseId: "case_new_001",
    } as GameSession);

    render(<StartCaseButton label="生成案件" mode="generated" />);
    fireEvent.click(screen.getByRole("button", { name: /生成案件/ }));

    expect(screen.getByRole("status")).toHaveTextContent("DeepSeek 正在生成案件");
    await waitFor(() => {
      expect(gameApi.createSession).toHaveBeenCalledWith("case_new_001");
      expect(push).toHaveBeenCalledWith(
        "/cases/case_new_001?session=ses_new_001",
      );
    });
  });

  it("keeps the refined fallback path when generation fails", async () => {
    vi.spyOn(gameApi, "generateCase").mockRejectedValue(
      new Error("新案件暂时无法生成"),
    );
    vi.spyOn(gameApi, "getFallbackCase").mockResolvedValue({
      caseId: "001",
    } as PublicCase);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_fallback_001",
      caseId: "001",
    } as GameSession);

    render(<StartCaseButton label="生成案件" mode="generated" />);
    fireEvent.click(screen.getByRole("button", { name: /生成案件/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("新案件暂时无法生成");
    fireEvent.click(screen.getByRole("button", { name: "改用精修案件继续体验" }));

    await waitFor(() => {
      expect(gameApi.getFallbackCase).toHaveBeenCalledOnce();
      expect(gameApi.createSession).toHaveBeenCalledWith("001");
      expect(push).toHaveBeenCalledWith("/cases/001?session=ses_fallback_001");
    });
  });
});
