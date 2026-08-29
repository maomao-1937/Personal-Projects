import { describe, expect, it, vi } from "vitest";

import {
  buildShareText,
  caseRoutes,
  clearSessionId,
  getSessionId,
  reportRequirements,
  storeSessionId,
} from "@/features/game/session";

describe("session helpers", () => {
  it("prefers the URL session id over local storage", () => {
    localStorage.setItem("ai-interrogation-session", "ses_local");

    expect(getSessionId("?session=ses_url")).toBe("ses_url");
  });

  it("falls back to local storage when the URL has no session", () => {
    localStorage.setItem("ai-interrogation-session", "ses_local");

    expect(getSessionId("")).toBe("ses_local");
  });

  it("keeps URL recovery working when browser storage is unavailable", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(getSessionId("?session=ses_url")).toBe("ses_url");
    expect(getSessionId("")).toBeNull();
    expect(() => storeSessionId("ses_url")).not.toThrow();
    expect(() => clearSessionId()).not.toThrow();

    getSpy.mockRestore();
    setSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("describes each missing report condition", () => {
    expect(
      reportRequirements({
        turnCount: 1,
        discoveredEvidenceIds: ["E01"],
        effectiveEvidenceIds: [],
      }),
    ).toEqual(["还需完成 2 次盘问", "还需发现 1 条证据", "还需 1 次有效证据命中"]);
  });

  it("builds spoiler-free share copy", () => {
    const text = buildShareText({
      caseTitle: "静默备份",
      grade: "S",
      score: 100,
      turnCount: 6,
    });

    expect(text).toContain("100 分");
    expect(text).toContain("6 个问题");
    expect(text).not.toContain("许沉");
    expect(text).not.toContain("备份盘在旧设备柜");
  });

  it("builds encoded routes for a generated case", () => {
    expect(caseRoutes("case_20260825_demo")).toEqual({
      briefing: "/case/case_20260825_demo/briefing",
      interrogate: "/case/case_20260825_demo/interrogate",
      report: "/case/case_20260825_demo/report",
      result: "/case/case_20260825_demo/result",
    });
  });
});
