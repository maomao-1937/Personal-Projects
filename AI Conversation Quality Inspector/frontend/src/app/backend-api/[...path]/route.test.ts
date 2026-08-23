import { afterEach, expect, it, vi } from "vitest";

import { POST } from "@/app/backend-api/[...path]/route";


afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});


it("reads the upstream address at request time and preserves auth headers", async () => {
  vi.stubEnv("BACKEND_API_BASE_URL", "http://127.0.0.1:8020");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ remaining_uses: 50 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "aqi_access=signed; HttpOnly; Path=/; SameSite=Lax",
      },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const request = new Request(
    "http://127.0.0.1:3010/backend-api/api/v1/access/redeem",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "existing=value",
        "X-CSRF-Token": "csrf-token",
      },
      body: JSON.stringify({ code: "pilot_example_1234567890" }),
    },
  );

  const response = await POST(request, {
    params: Promise.resolve({ path: ["api", "v1", "access", "redeem"] }),
  });

  expect(fetchMock).toHaveBeenCalledOnce();
  const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [
    string,
    RequestInit,
  ];
  expect(upstreamUrl).toBe("http://127.0.0.1:8020/api/v1/access/redeem");
  expect(upstreamInit.method).toBe("POST");
  const upstreamHeaders = new Headers(upstreamInit.headers);
  expect(upstreamHeaders.get("cookie")).toBe("existing=value");
  expect(upstreamHeaders.get("x-csrf-token")).toBe("csrf-token");
  expect(response.headers.get("set-cookie")).toContain("aqi_access=signed");
});
