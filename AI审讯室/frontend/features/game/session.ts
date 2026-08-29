const SESSION_KEY = "ai-interrogation-session";

export function getSessionId(search: string): string | null {
  const fromUrl = new URLSearchParams(search).get("session");
  if (fromUrl?.startsWith("ses_")) return fromUrl;
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    return stored?.startsWith("ses_") ? stored : null;
  } catch {
    return null;
  }
}

export function storeSessionId(sessionId: string): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SESSION_KEY, sessionId);
    } catch {
      // The URL remains the recovery source when browser storage is unavailable.
    }
  }
}

export function clearSessionId(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage can be blocked independently in privacy-focused browsers.
    }
    try {
      window.sessionStorage.removeItem("ai-interrogation-report-result");
    } catch {
      // A failed cleanup must not block creation of the next server session.
    }
  }
}

export function withSession(path: string, sessionId: string): string {
  return `${path}?session=${encodeURIComponent(sessionId)}`;
}

export function caseRoutes(caseId: string) {
  const root = `/case/${encodeURIComponent(caseId)}`;
  return {
    briefing: `${root}/briefing`,
    interrogate: `${root}/interrogate`,
    report: `${root}/report`,
    result: `${root}/result`,
  };
}

export function reportRequirements(session: {
  turnCount: number;
  discoveredEvidenceIds: string[];
  effectiveEvidenceIds: string[];
}): string[] {
  const missing: string[] = [];
  const turns = Math.max(0, 3 - session.turnCount);
  const evidence = Math.max(0, 2 - session.discoveredEvidenceIds.length);
  if (turns) missing.push(`还需完成 ${turns} 次盘问`);
  if (evidence) missing.push(`还需发现 ${evidence} 条证据`);
  if (session.effectiveEvidenceIds.length < 1) missing.push("还需 1 次有效证据命中");
  return missing;
}

export function buildShareText(input: {
  caseTitle: string;
  grade: string;
  score: number;
  turnCount: number;
}): string {
  return `我在《${input.caseTitle}》中获得 ${input.grade} 级、${input.score} 分，用 ${input.turnCount} 个问题完成审讯。你能更快看穿证词吗？`;
}
