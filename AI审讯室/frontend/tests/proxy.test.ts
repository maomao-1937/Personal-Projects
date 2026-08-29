import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { AUTH_COOKIE_NAME } from "@/features/auth/constants";
import { proxy } from "@/proxy";

describe("page access proxy", () => {
  it("redirects a protected page while preserving its local destination", () => {
    const response = proxy(
      new NextRequest("https://interrogation.example/case/001/briefing?session=ses_001"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://interrogation.example/access?next=%2Fcase%2F001%2Fbriefing%3Fsession%3Dses_001",
    );
  });

  it("allows protected pages when the access cookie is present", () => {
    const response = proxy(
      new NextRequest("https://interrogation.example/", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=signed-cookie` },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the access page reachable without a cookie", () => {
    const response = proxy(new NextRequest("https://interrogation.example/access"));

    expect(response.status).toBe(200);
  });
});
