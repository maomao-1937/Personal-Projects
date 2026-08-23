import { z } from "zod";


const API_PREFIX = "/backend-api";


const confidenceSchema = z.enum(["high", "medium", "low"]);
const riskLevelSchema = z.enum(["none", "low", "medium", "high", "unknown"]);
const qaTypeSchema = z.enum(["sales", "customer_service"]);
const dimensionNameSchema = z.enum([
  "需求理解",
  "情绪与语气",
  "信息准确性",
  "异议处理",
  "推进能力",
  "风险话术",
]);


const evidenceSchema = z
  .object({
    type: z.enum(["problematic_language", "missed_opportunity", "positive_behavior"]),
    turn_ids: z.array(z.string().regex(/^t[1-9][0-9]*$/)).min(1).max(4),
    quotes: z.array(z.string().min(1)).min(1).max(4),
    rationale: z.string().min(1),
  })
  .superRefine((evidence, context) => {
    if (evidence.turn_ids.length !== evidence.quotes.length) {
      context.addIssue({
        code: "custom",
        message: "Evidence turn and quote counts must match",
        path: ["quotes"],
      });
    }
  });


const dimensionSchema = z
  .object({
    name: dimensionNameSchema,
    status: z.enum(["scored", "not_applicable", "insufficient_context"]),
    score: z.number().int().min(0).max(100).nullable(),
    summary: z.string().min(1),
    evidence: z.array(evidenceSchema).max(6),
    improvement: z.string().min(1).nullable(),
    confidence: confidenceSchema,
  })
  .superRefine((dimension, context) => {
    if (dimension.status === "scored") {
      if (dimension.score === null) {
        context.addIssue({ code: "custom", message: "Scored dimension needs a score" });
      }
      if (dimension.evidence.length === 0) {
        context.addIssue({ code: "custom", message: "Scored dimension needs evidence" });
      }
      if (dimension.improvement === null) {
        context.addIssue({ code: "custom", message: "Scored dimension needs an improvement" });
      }
    } else if (dimension.score !== null) {
      context.addIssue({ code: "custom", message: "Unscored dimension cannot have a score" });
    }
  });


const dimensionsSchema = z.array(dimensionSchema).length(6).superRefine((dimensions, context) => {
  if (new Set(dimensions.map((dimension) => dimension.name)).size !== 6) {
    context.addIssue({ code: "custom", message: "Dimensions must be unique" });
  }
});


const majorIssueSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  dimension: dimensionNameSchema,
  title: z.string(),
  reason: z.string(),
  evidence_turn_ids: z.array(z.string()),
});


const accessBaseSchema = z.object({
  remaining_uses: z.number().int().nonnegative(),
  expires_at: z.string().datetime({ offset: true }),
  csrf_token: z.string().min(1),
});


const accessStatusSchema = accessBaseSchema.extend({ authenticated: z.literal(true) });
const publicConfigSchema = z.object({
  min_transcript_chars: z.number().int().positive(),
  max_transcript_chars: z.number().int().positive(),
  max_turns: z.number().int().positive(),
  invite_usage_limit: z.number().int().positive(),
  rubric_version: z.string(),
});


const analysisResponseSchema = z
  .object({
    analysis_id: z.string().min(1),
    qa_type: qaTypeSchema,
    analysis_status: z.enum(["scored", "partial", "unable_to_score"]),
    total_score: z.number().int().min(0).max(100).nullable(),
    scored_dimension_count: z.number().int().min(0).max(6),
    confidence: confidenceSchema,
    risk_level: riskLevelSchema,
    risk_flags: z.array(z.string()),
    rubric_version: z.string().min(1),
    prompt_version: z.string().min(1),
    model_version: z.string().min(1),
    dimensions: dimensionsSchema,
    major_issues: z.array(majorIssueSchema).max(3),
    suggested_reply: z.string().nullable(),
    limitations: z.array(z.string()),
    remaining_uses: z.number().int().nonnegative(),
  })
  .superRefine((report, context) => {
    const scoredCount = report.dimensions.filter(
      (dimension) => dimension.status === "scored",
    ).length;
    if (scoredCount !== report.scored_dimension_count) {
      context.addIssue({ code: "custom", message: "Scored dimension count is inconsistent" });
    }
    const validStatus =
      (report.analysis_status === "scored" && scoredCount >= 4 && report.total_score !== null) ||
      (report.analysis_status === "partial" &&
        scoredCount >= 1 &&
        scoredCount <= 3 &&
        report.total_score === null) ||
      (report.analysis_status === "unable_to_score" &&
        scoredCount === 0 &&
        report.total_score === null);
    if (!validStatus) {
      context.addIssue({ code: "custom", message: "Report status and total score are inconsistent" });
    }
  });


const feedbackResponseSchema = z.object({
  helpful: z.boolean(),
  reason_code: z
    .enum([
      "evidence_wrong",
      "score_unfair",
      "reply_unusable",
      "context_missing",
      "other",
    ])
    .nullable(),
});


const leaveResponseSchema = z.object({ cleared: z.literal(true) });
const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    request_id: z.string(),
    retryable: z.boolean().optional().default(false),
  }),
});


export type AccessStatus = z.infer<typeof accessStatusSchema>;
export type AccessResponse = z.infer<typeof accessBaseSchema>;
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type AnalysisRequest = {
  qa_type: z.infer<typeof qaTypeSchema>;
  transcript: string;
};
export type FeedbackReason = NonNullable<
  z.infer<typeof feedbackResponseSchema>["reason_code"]
>;


export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    requestId?: string;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
  }
}


async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError({
      code: "INVALID_RESPONSE",
      message: "服务返回了无法读取的响应。",
      status: response.status,
      retryable: response.status >= 500,
    });
  }

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(payload);
    if (parsedError.success) {
      throw new ApiError({
        code: parsedError.data.error.code,
        message: parsedError.data.error.message,
        status: response.status,
        requestId: parsedError.data.error.request_id,
        retryable: parsedError.data.error.retryable,
      });
    }
    throw new ApiError({
      code: "REQUEST_FAILED",
      message: "请求未能完成，请稍后重试。",
      status: response.status,
      retryable: response.status >= 500,
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      code: "INVALID_RESPONSE",
      message: "服务返回的数据不完整，请刷新后重试。",
      status: response.status,
      retryable: true,
    });
  }
  return parsed.data;
}


export const api = {
  getAccessStatus: () =>
    request("/api/v1/access/status", accessStatusSchema),

  redeemInvite: (code: string) =>
    request("/api/v1/access/redeem", accessBaseSchema, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  leaveAccess: (csrfToken: string) =>
    request("/api/v1/access", leaveResponseSchema, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),

  getPublicConfig: () => request("/api/v1/public/config", publicConfigSchema),

  analyze: (
    payload: AnalysisRequest,
    options: { csrfToken: string; idempotencyKey: string },
  ) =>
    request("/api/v1/analyses", analysisResponseSchema, {
      method: "POST",
      headers: {
        "X-CSRF-Token": options.csrfToken,
        "Idempotency-Key": options.idempotencyKey,
      },
      body: JSON.stringify(payload),
    }),

  putFeedback: (
    analysisId: string,
    payload: { helpful: boolean; reason_code?: FeedbackReason | null },
    csrfToken: string,
  ) =>
    request(`/api/v1/analyses/${analysisId}/feedback`, feedbackResponseSchema, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(payload),
    }),
};
