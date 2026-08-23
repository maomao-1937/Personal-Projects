import { createApiClient } from "@/lib/api/client";

describe("API client", () => {
  it("redeems a trimmed invite code with a same-origin JSON request", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({
          authenticated: true,
          remaining_redemptions: 49,
          expires_at: "2026-09-22T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const api = createApiClient(fetcher);
    const result = await api.redeemInvite("  BETA-1234  ");

    expect(result.remaining_redemptions).toBe(49);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("/api/v1/access/redeem");
    expect(calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ invite_code: "BETA-1234" }),
    });
  });

  it("normalizes backend errors without exposing response bodies", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "INVITE_EXHAUSTED",
            message: "邀请码使用次数已耗尽",
            trace_id: "trace-123",
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );

    const api = createApiClient(fetcher);

    await expect(api.redeemInvite("BETA-1234")).rejects.toMatchObject({
      name: "ApiError",
      code: "INVITE_EXHAUSTED",
      message: "邀请码使用次数已耗尽",
      status: 409,
      traceId: "trace-123",
    });
  });

  it("announces an expired access session when a protected request returns 401", async () => {
    const listener = vi.fn();
    window.addEventListener("meetingmemo:unauthorized", listener);
    const fetcher: typeof fetch = async () =>
      Response.json(
        { error: { code: "ACCESS_REQUIRED", message: "访问会话已失效" } },
        { status: 401 },
      );

    await expect(createApiClient(fetcher).listMeetings()).rejects.toMatchObject({
      status: 401,
    });
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("meetingmemo:unauthorized", listener);
  });

  it("loads the meeting list with the shared cookie contract", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await createApiClient(fetcher).listMeetings();

    expect(result.items).toEqual([]);
    expect(calls[0][0]).toBe("/api/v1/meetings");
    expect(calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("uploads transcript files without overriding the multipart boundary", async () => {
    let receivedInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      receivedInit = init;
      return new Response(
        JSON.stringify({ meeting_id: "meeting-1", segment_count: 3 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    await createApiClient(fetcher).uploadTranscript("meeting-1", file);

    expect(receivedInit?.body).toBeInstanceOf(FormData);
    expect(new Headers(receivedInit?.headers).has("Content-Type")).toBe(false);
  });

  it("accepts successful empty responses", async () => {
    const fetcher: typeof fetch = async () => new Response(null, { status: 204 });

    await expect(createApiClient(fetcher).logout()).resolves.toBeUndefined();
  });

  it("creates a meeting, attaches pasted text, and starts processing", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push([url, init]);
      if (url.endsWith("/summary-jobs")) {
        return Response.json({
          id: "job-1",
          meeting_id: "meeting-1",
          job_type: "summary",
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          error: null,
          created_at: "2026-08-23T00:00:00Z",
          updated_at: "2026-08-23T00:00:00Z",
        });
      }
      if (url.endsWith("/transcript")) {
        return Response.json({ meeting_id: "meeting-1", segment_count: 1 });
      }
      return Response.json(
        {
          id: "meeting-1",
          title: "周会",
          meeting_at: null,
          timezone: "Asia/Shanghai",
          source: "manual",
          language: "zh-CN",
          status: "draft",
          created_at: "2026-08-23T00:00:00Z",
          updated_at: "2026-08-23T00:00:00Z",
        },
        { status: 201 },
      );
    };
    const client = createApiClient(fetcher);

    const meeting = await client.createMeeting({
      title: "周会",
      meeting_at: null,
      timezone: "Asia/Shanghai",
      language: "zh-CN",
    });
    await client.replaceTranscriptText(meeting.id, "主持人：确认本周发布。");
    const job = await client.createSummaryJob(meeting.id);

    expect(job.status).toBe("queued");
    expect(calls.map(([url]) => url)).toEqual([
      "/api/v1/meetings",
      "/api/v1/meetings/meeting-1/transcript",
      "/api/v1/meetings/meeting-1/summary-jobs",
    ]);
    expect(calls[1][1]?.body).toBe(
      JSON.stringify({ text: "主持人：确认本周发布。" }),
    );
  });

  it("uses versioned summary mutation and delivery endpoints", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const summary = {
      id: "summary-1",
      meeting_id: "meeting-1",
      version: 1,
      schema_version: "1.0",
      content: {
        summary_version: "1.0" as const,
        headline: "结论",
        topics: [],
        decisions: [],
        action_items: [],
        open_questions: [],
        quality_flags: [],
      },
      quality_flags: [],
      status: "draft",
      parent_version_id: null,
      created_source: "ai",
      created_at: "2026-08-23T00:00:00Z",
    };
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([String(input), init]);
      return Response.json(summary);
    };
    const client = createApiClient(fetcher);

    await client.createRevision("summary-1", 1, summary.content);
    await client.approveSummary("summary-1");
    await client.deliverSummary("summary-1", "slack");

    expect(calls.map(([url]) => url)).toEqual([
      "/api/v1/summaries/summary-1/revisions",
      "/api/v1/summaries/summary-1/approve",
      "/api/v1/summaries/summary-1/deliveries",
    ]);
    expect(calls[0][1]?.body).toBe(
      JSON.stringify({ expected_version: 1, content: summary.content }),
    );
    expect(calls[2][1]?.body).toBe(
      JSON.stringify({ channel: "slack", target: "configured-default" }),
    );
  });
});
