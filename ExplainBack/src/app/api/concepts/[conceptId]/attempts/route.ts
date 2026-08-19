import { parseJson, toErrorResponse } from "@/lib/http";
import { submitAttemptInputSchema } from "@/lib/validation";
import { submitAttempt } from "@/server/services/training-service";

export const runtime = "nodejs";

interface ConceptContext {
  params: Promise<{ conceptId: string }>;
}

export async function POST(
  request: Request,
  context: ConceptContext,
): Promise<Response> {
  try {
    const { conceptId } = await context.params;
    const input = await parseJson(request, submitAttemptInputSchema);
    const result = await submitAttempt(conceptId, input);
    return Response.json({ data: result });
  } catch (error) {
    return toErrorResponse(error);
  }
}

