import { describe, expect, it, vi } from "vitest";

import {
  API_AUTH_REQUIRED_EVENT,
  apiRequest,
  AppError,
  authApi,
  gameApi,
} from "@/features/game/api";

describe("apiRequest", () => {
  it("posts the case prompt with enough time for analysis and generation", async () => {
    const timer = vi.spyOn(window, "setTimeout");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ caseId: "case_idea" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    try {
      await gameApi.generateCase({ prompt: "博物馆失窃" });
      expect(fetcher).toHaveBeenCalledWith("/api/v1/cases/generate", expect.objectContaining({
        method: "POST", body: JSON.stringify({ prompt: "博物馆失窃" }),
      }));
      expect(timer).toHaveBeenCalledWith(expect.any(Function), 150_000);
    } finally { timer.mockRestore(); vi.unstubAllGlobals(); }
  });
  it("returns parsed JSON on success", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiRequest<{ status: string }>("/health", {}, fetcher)).resolves.toEqual({
      status: "ok",
    });
  });

  it("supports empty login responses and includes same-origin credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);

    await expect(authApi.login("ONE-TOKEN")).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("announces an expired access session without handling invalid login tokens", async () => {
    const listener = vi.fn();
    window.addEventListener(API_AUTH_REQUIRED_EVENT, listener);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "AUTH_REQUIRED", message: "访问会话已失效，请重新验证。" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(apiRequest("/cases/001", {}, fetcher)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(API_AUTH_REQUIRED_EVENT, listener);
  });

  it("normalizes a backend error without exposing raw details", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "REPORT_LOCKED", message: "当前证据条件还不足以提交结案报告。" },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(apiRequest("/report", {}, fetcher)).rejects.toEqual(
      new AppError("REPORT_LOCKED", "当前证据条件还不足以提交结案报告。", 409),
    );
  });

  it("turns a stalled request into a recoverable timeout error", async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    );

    await expect(apiRequest("/health", {}, fetcher as typeof fetch, 1)).rejects.toEqual(
      new AppError("TIMEOUT_ERROR", "案件服务响应超时，请重试。", 0),
    );
  });
});
