import { z } from "zod";

import { AiConfigurationError } from "@/server/ai/tutor";
import { ServiceError } from "@/server/services/errors";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const flattened = z.flattenError(error).fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );
}

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "请求内容不是有效 JSON");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "请检查输入内容",
      zodFieldErrors(parsed.error),
    );
  }
  return parsed.data;
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ServiceError) {
    const statusByCode = {
      NOT_FOUND: 404,
      CONFLICT: 409,
      INVALID_STATE: 409,
      AI_CONFIGURATION: 503,
      AI_UNAVAILABLE: 502,
    } as const;
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.resourceId ? { resourceId: error.resourceId } : {}),
        },
      },
      { status: statusByCode[error.code] },
    );
  }

  if (error instanceof AiConfigurationError) {
    return Response.json(
      {
        error: {
          code: "AI_CONFIGURATION",
          message: "AI 尚未配置，请检查服务端环境变量",
        },
      },
      { status: 503 },
    );
  }

  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "服务暂时不可用，请稍后重试",
      },
    },
    { status: 500 },
  );
}

