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

    render(<StartCaseButton />);
    fireEvent.click(screen.getByRole("button", { name: /开始免费案件/ }));

    expect(screen.getByRole("status")).toHaveTextContent("AI 正在创建本局专属案件");
    await waitFor(() => {
      expect(gameApi.createSession).toHaveBeenCalledWith("case_new_001");
      expect(push).toHaveBeenCalledWith(
        "/case/case_new_001/briefing?session=ses_new_001",
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

    render(<StartCaseButton />);
    fireEvent.click(screen.getByRole("button", { name: /开始免费案件/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("新案件暂时无法生成");
    fireEvent.click(screen.getByRole("button", { name: "改用精修固定案继续体验" }));

    await waitFor(() => {
      expect(gameApi.getFallbackCase).toHaveBeenCalledOnce();
      expect(gameApi.createSession).toHaveBeenCalledWith("001");
      expect(push).toHaveBeenCalledWith("/case/001/briefing?session=ses_fallback_001");
    });
  });
});
