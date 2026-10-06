import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gameApi } from "@/features/game/api";
import { getSessionId, storeSessionId } from "@/features/game/session";
import { useCaseLaunch } from "@/features/game/use-case-launch";
import type { GameSession, PublicCase } from "@/features/game/types";

const push = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("useCaseLaunch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(["generated", "fallback"] as const)("does not open an abandoned %s case after its request resolves", async (kind) => {
    const pendingCase = deferred<PublicCase>();
    vi.spyOn(gameApi, kind === "generated" ? "generateCase" : "getFallbackCase")
      .mockReturnValue(pendingCase.promise);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({ sessionId: "ses_abandoned" } as GameSession);
    const onComplete = vi.fn();
    const { result, unmount } = renderHook(() => useCaseLaunch({ introDurationMs: 4_000, onComplete }));
    let pendingLaunch!: Promise<void>;
    act(() => {
      pendingLaunch = kind === "generated" ? result.current.startGenerated("旧案件") : result.current.startFallback();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(result.current.lifecycleState).toBe("GENERATING");
    unmount();
    storeSessionId("ses_newer_launch");
    sessionStorage.setItem("ai-interrogation-report-result", "newer-report");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    await act(async () => {
      pendingCase.resolve({ caseId: "case_abandoned" } as PublicCase);
      await pendingLaunch;
    });
    expect(gameApi.createSession).not.toHaveBeenCalled();
    expect(getSessionId("")).toBe("ses_newer_launch");
    expect(sessionStorage.getItem("ai-interrogation-report-result")).toBe("newer-report");
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it.each(["generated", "fallback"] as const)("does not replace recovery storage when an abandoned %s session resolves", async (kind) => {
    vi.spyOn(gameApi, kind === "generated" ? "generateCase" : "getFallbackCase")
      .mockResolvedValue({ caseId: "case_abandoned" } as PublicCase);
    const pendingSession = deferred<GameSession>();
    vi.spyOn(gameApi, "createSession").mockReturnValue(pendingSession.promise);
    const onComplete = vi.fn();
    const { result, unmount } = renderHook(() => useCaseLaunch({ onComplete }));
    let pendingLaunch!: Promise<void>;
    await act(async () => {
      pendingLaunch = kind === "generated" ? result.current.startGenerated("旧案件") : result.current.startFallback();
    });
    expect(gameApi.createSession).toHaveBeenCalledExactlyOnceWith("case_abandoned");
    unmount();
    storeSessionId("ses_newer_launch");
    sessionStorage.setItem("ai-interrogation-report-result", "newer-report");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    await act(async () => {
      pendingSession.resolve({ sessionId: "ses_abandoned" } as GameSession);
      await pendingLaunch;
    });
    expect(getSessionId("")).toBe("ses_newer_launch");
    expect(sessionStorage.getItem("ai-interrogation-report-result")).toBe("newer-report");
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("passes a trimmed player prompt while keeping legacy callers optional", async () => {
    vi.spyOn(gameApi, "generateCase").mockRejectedValue(new Error("生成失败"));
    const { result } = renderHook(() => useCaseLaunch());
    await act(async () => { await result.current.startGenerated("  博物馆的展画被调包  "); });
    expect(gameApi.generateCase).toHaveBeenCalledWith({ prompt: "博物馆的展画被调包" });
    await act(async () => { await result.current.startGenerated(); });
    expect(gameApi.generateCase).toHaveBeenLastCalledWith();
  });

  it("starts generation immediately but preserves the intro and locked hold", async () => {
    vi.spyOn(gameApi, "generateCase").mockResolvedValue({
      caseId: "case_new_001",
    } as PublicCase);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_new_001",
      caseId: "case_new_001",
    } as GameSession);

    const { result } = renderHook(() =>
      useCaseLaunch({ introDurationMs: 4_000, lockedDurationMs: 500 }),
    );

    act(() => {
      void result.current.startGenerated();
    });

    expect(gameApi.generateCase).toHaveBeenCalledOnce();
    expect(result.current.lifecycleState).toBe("CEREMONY");
    expect(result.current.phaseText).toBe("正在检索档案...");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999);
    });
    expect(gameApi.createSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(gameApi.createSession).toHaveBeenCalledWith("case_new_001");
    expect(result.current.lifecycleState).toBe("LOCKING");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.lifecycleState).toBe("COMPLETED");
    expect(push).toHaveBeenCalledWith(
      "/case/case_new_001/briefing?session=ses_new_001",
    );
  });

  it("keeps the sealed generating scene while a slow case is still pending", async () => {
    const generated = deferred<PublicCase>();
    vi.spyOn(gameApi, "generateCase").mockReturnValue(generated.promise);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_slow_001",
      caseId: "case_slow_001",
    } as GameSession);
    const { result } = renderHook(() =>
      useCaseLaunch({ introDurationMs: 4_000, lockedDurationMs: 500 }),
    );

    act(() => {
      void result.current.startGenerated();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(result.current.lifecycleState).toBe("GENERATING");
    expect(gameApi.createSession).not.toHaveBeenCalled();

    await act(async () => {
      generated.resolve({ caseId: "case_slow_001" } as PublicCase);
      await Promise.resolve();
    });
    expect(gameApi.createSession).toHaveBeenCalledWith("case_slow_001");
    expect(result.current.lifecycleState).toBe("LOCKING");
  });

  it("prevents duplicate generation requests from rapid clicks", () => {
    vi.spyOn(gameApi, "generateCase").mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useCaseLaunch());

    act(() => {
      void result.current.startGenerated();
      void result.current.startGenerated();
    });

    expect(gameApi.generateCase).toHaveBeenCalledOnce();
  });

  it("waits for the intro before exposing a generation failure", async () => {
    vi.spyOn(gameApi, "generateCase").mockRejectedValue(
      new Error("新案件暂时无法生成"),
    );
    vi.spyOn(gameApi, "createSession");
    const { result } = renderHook(() =>
      useCaseLaunch({ introDurationMs: 4_000, lockedDurationMs: 500 }),
    );

    act(() => {
      void result.current.startGenerated();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999);
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.lifecycleState).toBe("ERROR");
    expect(result.current.error).toBe("新案件暂时无法生成");
    expect(gameApi.createSession).not.toHaveBeenCalled();
  });

  it("opens the fallback case after a generation error", async () => {
    vi.spyOn(gameApi, "generateCase").mockRejectedValue(new Error("生成失败"));
    vi.spyOn(gameApi, "getFallbackCase").mockResolvedValue({
      caseId: "001",
    } as PublicCase);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_fallback_001",
      caseId: "001",
    } as GameSession);
    const { result } = renderHook(() => useCaseLaunch());

    await act(async () => {
      await result.current.startGenerated();
    });
    await act(async () => {
      await result.current.startFallback();
    });

    expect(gameApi.getFallbackCase).toHaveBeenCalledOnce();
    expect(gameApi.createSession).toHaveBeenCalledWith("001");
    expect(push).toHaveBeenCalledWith("/case/001/briefing?session=ses_fallback_001");
  });

  it("advances one concise status line at eight and twenty-four seconds", async () => {
    vi.spyOn(gameApi, "generateCase").mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useCaseLaunch());

    act(() => {
      void result.current.startGenerated();
    });
    expect(result.current.phaseText).toBe("正在检索档案...");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(result.current.phaseText).toBe("构建行为模型...");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(result.current.phaseText).toBe("核验证据链...");
  });

  it("calls the supplied completion callback after the locking hold", async () => {
    const onComplete = vi.fn();
    vi.spyOn(gameApi, "generateCase").mockResolvedValue({
      caseId: "case_callback_001",
    } as PublicCase);
    vi.spyOn(gameApi, "createSession").mockResolvedValue({
      sessionId: "ses_callback_001",
      caseId: "case_callback_001",
    } as GameSession);
    const { result } = renderHook(() =>
      useCaseLaunch({
        introDurationMs: 4_000,
        lockedDurationMs: 500,
        onComplete,
      }),
    );

    act(() => {
      void result.current.startGenerated();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });

    expect(result.current.lifecycleState).toBe("COMPLETED");
    expect(onComplete).toHaveBeenCalledWith({
      caseId: "case_callback_001",
      sessionId: "ses_callback_001",
    });
    expect(push).not.toHaveBeenCalled();
  });
});
