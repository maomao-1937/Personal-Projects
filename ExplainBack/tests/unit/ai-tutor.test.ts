import { describe, expect, it } from "vitest";

import {
  DEFAULT_AI_TIMEOUT_MS,
  getAiTimeoutMs,
} from "@/server/ai/tutor";

describe("AI tutor timeout", () => {
  it("使用明确且有边界的模型调用超时", () => {
    expect(getAiTimeoutMs("")).toBe(DEFAULT_AI_TIMEOUT_MS);
    expect(getAiTimeoutMs("45000")).toBe(45_000);
    expect(getAiTimeoutMs("0")).toBe(DEFAULT_AI_TIMEOUT_MS);
    expect(getAiTimeoutMs("not-a-number")).toBe(DEFAULT_AI_TIMEOUT_MS);
  });
});
