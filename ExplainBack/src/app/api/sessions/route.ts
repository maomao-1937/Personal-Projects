import { parseJson, toErrorResponse } from "@/lib/http";
import { createSessionInputSchema } from "@/lib/validation";
import { createStudySession } from "@/server/services/session-service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await parseJson(request, createSessionInputSchema);
    const session = await createStudySession(input);
    return Response.json({ data: session }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

