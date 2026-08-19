import { toErrorResponse } from "@/lib/http";
import { abandonTraining } from "@/server/services/training-service";

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
    const concept = abandonTraining(conceptId);
    return Response.json({ data: concept });
  } catch (error) {
    return toErrorResponse(error);
  }
}

