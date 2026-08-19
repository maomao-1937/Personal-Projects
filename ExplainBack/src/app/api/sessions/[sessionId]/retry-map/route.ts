import { toErrorResponse } from "@/lib/http";
import { retryLearningMap } from "@/server/services/session-service";

export const runtime = "nodejs";

interface RetryMapContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(
  _request: Request,
  context: RetryMapContext,
): Promise<Response> {
  try {
    const { sessionId } = await context.params;
    const session = await retryLearningMap(sessionId);
    return Response.json({ data: session });
  } catch (error) {
    return toErrorResponse(error);
  }
}

