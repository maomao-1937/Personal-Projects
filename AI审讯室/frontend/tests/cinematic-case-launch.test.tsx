import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gameApi } from "@/features/game/api";
import { CinematicCaseLaunch } from "@/features/game/components/cinematic-case-launch";
import type { GameSession, PublicCase } from "@/features/game/types";

const push = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("CinematicCaseLaunch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts the real launch flow from one concise cinematic prompt", async () => {
    vi.spyOn(gameApi, "generateCase").mockResolvedValue({
      caseId: "case_cinema_001",
    } as PublicCase);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_cinema_001",
      caseId: "case_cinema_001",
    } as GameSession);

    render(<CinematicCaseLaunch />);

    const scene = screen.getByRole("region", { name: "AI 嫌疑人案件生成场景" });
    expect(scene).toHaveAttribute("aria-busy", "false");
    expect(scene).toHaveAttribute("data-launch-state", "IDLE");
    expect(scene).toHaveAttribute("data-scene-version", "v3");
    expect(screen.getByTestId("containment-shell")).toBeInTheDocument();
    expect(screen.getByTestId("containment-gate")).toBeInTheDocument();
    expect(screen.getByTestId("containment-gate")).not.toBe(
      screen.getByTestId("containment-shell"),
    );
    expect(screen.getByTestId("ai-suspect")).toBeInTheDocument();
    expect(screen.getByTestId("foreground-interrogator")).toBeInTheDocument();
    expect(screen.getByText("会撒谎")).toHaveClass("cinematic-copy__shift");
    expect(screen.getByText("无法改写真相")).toHaveClass("cinematic-copy__truth");
    expect(screen.getByText("AI 嫌疑人")).toHaveClass("cinematic-copy__shift");

    fireEvent.click(screen.getByRole("button", { name: "生成案件" }));
    expect(gameApi.generateCase).toHaveBeenCalledOnce();
    expect(scene).toHaveAttribute("aria-busy", "true");
    expect(scene).toHaveAttribute("data-launch-state", "CEREMONY");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(scene).toHaveAttribute("data-launch-state", "LOCKING");
    expect(screen.getByText("TRUTH LOCKED")).toBeVisible();
    expect(screen.getByText("真相已封存")).toBeVisible();
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(scene).toHaveAttribute("data-launch-state", "COMPLETED");
    expect(push).toHaveBeenCalledWith(
      "/case/case_cinema_001/briefing?session=ses_cinema_001",
    );
  });

  it("does not start a second generation while the ceremony is active", () => {
    vi.spyOn(gameApi, "generateCase").mockReturnValue(new Promise(() => {}));
    render(<CinematicCaseLaunch />);

    const button = screen.getByRole("button", { name: "生成案件" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(gameApi.generateCase).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
  });

  it("shows only the current generation status after the four-second intro", async () => {
    const generated = deferred<PublicCase>();
    vi.spyOn(gameApi, "generateCase").mockReturnValue(generated.promise);
    render(<CinematicCaseLaunch />);

    fireEvent.click(screen.getByRole("button", { name: "生成案件" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("正在检索档案...");
    expect(status).not.toHaveTextContent("构建行为模型...");
    expect(status).not.toHaveTextContent("核验证据链...");
  });

  it("offers the existing refined fallback after generation fails", async () => {
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
    render(<CinematicCaseLaunch />);

    fireEvent.click(screen.getByRole("button", { name: "生成案件" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("新案件暂时无法生成");
    fireEvent.click(screen.getByRole("button", { name: "改用精修固定案继续体验" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(gameApi.getFallbackCase).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/case/001/briefing?session=ses_fallback_001");
  });

  it("exposes the completed payload to an optional host callback", async () => {
    const onComplete = vi.fn();
    vi.spyOn(gameApi, "generateCase").mockResolvedValue({
      caseId: "case_embedded_001",
    } as PublicCase);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_embedded_001",
      caseId: "case_embedded_001",
    } as GameSession);

    render(<CinematicCaseLaunch onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "生成案件" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });

    expect(onComplete).toHaveBeenCalledWith({
      caseId: "case_embedded_001",
      sessionId: "ses_embedded_001",
    });
    expect(push).not.toHaveBeenCalled();
  });
});
