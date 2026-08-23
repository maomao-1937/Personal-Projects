import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "@/lib/api";


const accessPayload = {
  authenticated: true,
  remaining_uses: 50,
  expires_at: "2026-08-23T00:00:00Z",
  csrf_token: "csrf-token",
};

const dimensionNames = [
  "需求理解",
  "情绪与语气",
  "信息准确性",
  "异议处理",
  "推进能力",
  "风险话术",
] as const;


function unableDimensions() {
  return dimensionNames.map((name) => ({
    name,
    status: "insufficient_context",
    score: null,
    summary: "信息不足，无法可靠判断。",
    evidence: [],
    improvement: null,
    confidence: "low",
  }));
}


afterEach(() => {
  vi.unstubAllGlobals();
});


describe("API client", () => {
  it("sends first-party credentials and validates access status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(accessPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const access = await api.getAccessStatus();

    expect(access.remaining_uses).toBe(50);
    expect(fetchMock).toHaveBeenCalledWith(
      "/backend-api/api/v1/access/status",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("adds CSRF and idempotency headers to analysis requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          analysis_id: "analysis-1",
          qa_type: "sales",
          analysis_status: "unable_to_score",
          total_score: null,
          scored_dimension_count: 0,
          confidence: "low",
          risk_level: "unknown",
          risk_flags: [],
          rubric_version: "qa-rubric-v1",
          prompt_version: "qa-analysis-v1",
          model_version: "fake-model-v1",
          dimensions: unableDimensions(),
          major_issues: [],
          suggested_reply: null,
          limitations: ["信息不足"],
          remaining_uses: 49,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.analyze(
      { qa_type: "sales", transcript: "客户：你好\n销售：您好，请问有什么可以帮您？" },
      { csrfToken: "csrf-token", idempotencyKey: "request-1" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/backend-api/api/v1/analyses",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-token",
          "Idempotency-Key": "request-1",
        }),
      }),
    );
  });

  it("validates the public runtime limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            min_transcript_chars: 24,
            max_transcript_chars: 8_000,
            max_turns: 120,
            invite_usage_limit: 80,
            rubric_version: "qa-rubric-v2",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(api.getPublicConfig()).resolves.toMatchObject({
      min_transcript_chars: 24,
      invite_usage_limit: 80,
    });
  });

  it("maps backend errors without leaking unknown response data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "LLM_NOT_CONFIGURED",
              message: "模型服务尚未配置。",
              request_id: "req-1",
              retryable: false,
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(api.getAccessStatus()).rejects.toMatchObject({
      code: "LLM_NOT_CONFIGURED",
      message: "模型服务尚未配置。",
      status: 503,
    });
  });

  it("rejects successful responses with an invalid contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ authenticated: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(api.getAccessStatus()).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects an analysis whose six dimensions are not unique", async () => {
    const dimensions = unableDimensions();
    dimensions[5] = { ...dimensions[5], name: "需求理解" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            analysis_id: "analysis-invalid",
            qa_type: "sales",
            analysis_status: "unable_to_score",
            total_score: null,
            scored_dimension_count: 0,
            confidence: "low",
            risk_level: "unknown",
            risk_flags: [],
            rubric_version: "qa-rubric-v1",
            prompt_version: "qa-analysis-v1",
            model_version: "fake-model-v1",
            dimensions,
            major_issues: [],
            suggested_reply: null,
            limitations: ["信息不足"],
            remaining_uses: 50,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      api.analyze(
        { qa_type: "sales", transcript: "客户：你好\n销售：您好，请问需要什么帮助？" },
        { csrfToken: "csrf-token", idempotencyKey: "request-invalid" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
