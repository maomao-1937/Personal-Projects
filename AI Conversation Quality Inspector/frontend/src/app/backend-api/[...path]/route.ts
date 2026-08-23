const REQUEST_HEADER_NAMES = [
  "accept",
  "content-type",
  "cookie",
  "idempotency-key",
  "x-csrf-token",
  "x-request-id",
] as const;

const RESPONSE_HEADER_NAMES = [
  "cache-control",
  "content-language",
  "content-type",
  "etag",
  "x-request-id",
] as const;


function backendBaseUrl(): string {
  const rawUrl = process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8010";
  const parsedUrl = new URL(rawUrl);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("BACKEND_API_BASE_URL must use HTTP or HTTPS");
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("BACKEND_API_BASE_URL must not contain credentials");
  }
  return parsedUrl.toString().replace(/\/$/, "");
}


function errorResponse(): Response {
  return Response.json(
    {
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "服务暂时不可用，请稍后重试。",
        request_id: crypto.randomUUID(),
        retryable: true,
      },
    },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}


async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const { path } = await context.params;
    const incomingUrl = new URL(request.url);
    const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
    const upstreamUrl = `${backendBaseUrl()}/${encodedPath}${incomingUrl.search}`;
    const requestHeaders = new Headers();
    for (const name of REQUEST_HEADER_NAMES) {
      const value = request.headers.get(name);
      if (value !== null) requestHeaders.set(name, value);
    }

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const upstream = await fetch(upstreamUrl, {
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      headers: requestHeaders,
      method: request.method,
      redirect: "manual",
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of RESPONSE_HEADER_NAMES) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    const cookies =
      typeof upstream.headers.getSetCookie === "function"
        ? upstream.headers.getSetCookie()
        : [upstream.headers.get("set-cookie")].filter(
            (cookie): cookie is string => cookie !== null,
          );
    for (const cookie of cookies) {
      responseHeaders.append("Set-Cookie", cookie);
    }
    return new Response(upstream.body, {
      headers: responseHeaders,
      status: upstream.status,
      statusText: upstream.statusText,
    });
  } catch {
    return errorResponse();
  }
}


export const dynamic = "force-dynamic";
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
