import type {
  AccessSessionResponse,
  ApiErrorBody,
  DeliveryResponse,
  IntegrationsResponse,
  Meeting,
  MeetingCreateInput,
  MeetingDetail,
  MeetingListResponse,
  ProcessingJob,
  RedeemResponse,
  SummaryListResponse,
  SummaryPayload,
  SummaryVersion,
  TranscriptUpdateResponse,
} from "@/lib/types/api";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;

  constructor(
    message: string,
    options: { code: string; status: number; traceId?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.traceId = options.traceId;
  }
}

export const ACCESS_REVOKED_EVENT = "meetingmemo:unauthorized";

function announceRevokedAccess(input: RequestInfo | URL, response: Response) {
  if (response.status !== 401 || typeof window === "undefined") return;
  const path = String(input);
  if (path.endsWith("/api/v1/access/session") || path.endsWith("/api/v1/access/redeem")) {
    return;
  }
  window.dispatchEvent(new Event(ACCESS_REVOKED_EVENT));
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Non-JSON upstream failures are intentionally replaced with a safe message.
  }
  return new ApiError(body.error?.message ?? "请求失败，请稍后重试", {
    code: body.error?.code ?? "REQUEST_FAILED",
    status: response.status,
    traceId: body.error?.trace_id,
  });
}

async function requestJson<T>(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetcher(input, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    announceRevokedAccess(input, response);
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

async function requestVoid(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<void> {
  const response = await fetcher(input, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) {
    announceRevokedAccess(input, response);
    throw await parseError(response);
  }
}

export function createApiClient(fetcher: typeof fetch = fetch) {
  return {
    getSession() {
      return requestJson<AccessSessionResponse>(
        fetcher,
        "/api/v1/access/session",
      );
    },
    redeemInvite(inviteCode: string) {
      return requestJson<RedeemResponse>(fetcher, "/api/v1/access/redeem", {
        method: "POST",
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });
    },
    logout() {
      return requestVoid(fetcher, "/api/v1/access/logout", { method: "POST" });
    },
    listMeetings() {
      return requestJson<MeetingListResponse>(fetcher, "/api/v1/meetings");
    },
    createMeeting(payload: MeetingCreateInput) {
      return requestJson<Meeting>(fetcher, "/api/v1/meetings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    getMeeting(meetingId: string) {
      return requestJson<MeetingDetail>(
        fetcher,
        `/api/v1/meetings/${meetingId}`,
      );
    },
    replaceTranscriptText(meetingId: string, text: string) {
      return requestJson<TranscriptUpdateResponse>(
        fetcher,
        `/api/v1/meetings/${meetingId}/transcript`,
        { method: "POST", body: JSON.stringify({ text }) },
      );
    },
    uploadTranscript(meetingId: string, file: File) {
      const form = new FormData();
      form.set("file", file);
      return requestJson<TranscriptUpdateResponse>(
        fetcher,
        `/api/v1/meetings/${meetingId}/transcript-file`,
        { method: "POST", body: form },
      );
    },
    deleteMeeting(meetingId: string) {
      return requestVoid(fetcher, `/api/v1/meetings/${meetingId}`, {
        method: "DELETE",
      });
    },
    createSummaryJob(meetingId: string) {
      return requestJson<ProcessingJob>(
        fetcher,
        `/api/v1/meetings/${meetingId}/summary-jobs`,
        { method: "POST" },
      );
    },
    getJob(jobId: string) {
      return requestJson<ProcessingJob>(fetcher, `/api/v1/jobs/${jobId}`);
    },
    retryJob(jobId: string) {
      return requestJson<ProcessingJob>(fetcher, `/api/v1/jobs/${jobId}/retry`, {
        method: "POST",
      });
    },
    listSummaries(meetingId: string) {
      return requestJson<SummaryListResponse>(
        fetcher,
        `/api/v1/meetings/${meetingId}/summaries`,
      );
    },
    createRevision(
      summaryId: string,
      expectedVersion: number,
      content: SummaryPayload,
    ) {
      return requestJson<SummaryVersion>(
        fetcher,
        `/api/v1/summaries/${summaryId}/revisions`,
        {
          method: "POST",
          body: JSON.stringify({
            expected_version: expectedVersion,
            content,
          }),
        },
      );
    },
    approveSummary(summaryId: string) {
      return requestJson<SummaryVersion>(
        fetcher,
        `/api/v1/summaries/${summaryId}/approve`,
        { method: "POST" },
      );
    },
    getIntegrations() {
      return requestJson<IntegrationsResponse>(fetcher, "/api/v1/integrations");
    },
    deliverSummary(summaryId: string, channel: "slack" | "email") {
      return requestJson<DeliveryResponse>(
        fetcher,
        `/api/v1/summaries/${summaryId}/deliveries`,
        {
          method: "POST",
          body: JSON.stringify({ channel, target: "configured-default" }),
        },
      );
    },
    exportUrl(summaryId: string, format: "markdown" | "text" | "json") {
      return `/api/v1/summaries/${summaryId}/export?format=${format}`;
    },
  };
}

export const api = createApiClient();
export type ApiClient = ReturnType<typeof createApiClient>;
