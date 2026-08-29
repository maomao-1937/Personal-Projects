import type {
  GameSession,
  PublicCase,
  ReportDraft,
  ScoreResult,
  Tactic,
  TurnResult,
} from "./types";

const API_ROOT = "/api/v1";

export const API_AUTH_REQUIRED_EVENT = "ai-interrogation:auth-required";

export type AuthRequiredEvent = CustomEvent<{ nextPath: string }>;

type ErrorPayload = {
  error?: { code?: string; message?: string };
};

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetcher(`${API_ROOT}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });
  } catch {
    if (timedOut) {
      throw new AppError("TIMEOUT_ERROR", "案件服务响应超时，请重试。", 0);
    }
    if (controller.signal.aborted) {
      throw new AppError("REQUEST_ABORTED", "请求已取消，请重试。", 0);
    }
    throw new AppError("NETWORK_ERROR", "无法连接案件服务，请检查网络后重试。", 0);
  } finally {
    window.clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", onCallerAbort);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => ({}))) as T & ErrorPayload;
  if (!response.ok) {
    const error = new AppError(
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? "这次操作没有完成，请重试。",
      response.status,
    );
    if (error.code === "AUTH_REQUIRED" && !path.startsWith("/auth/")) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.dispatchEvent(
        new CustomEvent(API_AUTH_REQUIRED_EVENT, { detail: { nextPath } }),
      );
    }
    throw error;
  }
  return payload;
}

export const authApi = {
  login: (accessToken: string) =>
    apiRequest<void>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    }),
  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
};

export const gameApi = {
  getCase: (caseId: string) =>
    apiRequest<PublicCase>(`/cases/${encodeURIComponent(caseId)}`),
  generateCase: (input: { theme?: string; difficulty?: "standard" | "hard" } = {}) =>
    apiRequest<PublicCase>("/cases/generate", {
      method: "POST",
      body: JSON.stringify(input),
    }, fetch, 120_000),
  getFallbackCase: () =>
    apiRequest<PublicCase>("/cases/fallback", { method: "POST" }),
  createSession: (caseId: string) =>
    apiRequest<GameSession>("/sessions", {
      method: "POST",
      body: JSON.stringify({ caseId }),
    }),
  getSession: (sessionId: string) =>
    apiRequest<GameSession>(`/sessions/${encodeURIComponent(sessionId)}`),
  submitTurn: (
    sessionId: string,
    input: { message: string; tactic: Tactic; evidenceId: string | null; requestId: string },
  ) =>
    apiRequest<TurnResult>(`/sessions/${encodeURIComponent(sessionId)}/turns`, {
      method: "POST",
      body: JSON.stringify(input),
    }, fetch, 45_000),
  submitReport: (sessionId: string, report: ReportDraft) =>
    apiRequest<ScoreResult>(`/sessions/${encodeURIComponent(sessionId)}/reports`, {
      method: "POST",
      body: JSON.stringify(report),
    }),
};
