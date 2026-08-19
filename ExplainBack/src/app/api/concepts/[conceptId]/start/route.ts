import { toErrorResponse } from "@/lib/http";
import { startTraining } from "@/server/services/training-service";

export const runtime = "nodejs";

interface ConceptContext {
  params: Promise<{ conceptId: string }>;
}

export async function POST(
  _request: Request,
  context: ConceptContext,
): Promise<Response> {
  try {
    const { conceptId } = await context.params;
    const training = await startTraining(conceptId);
    return Response.json({ data: training });
  } catch (error) {
    return toErrorResponse(error);
  }
}

