import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, safeNextPath } from "@/features/auth/constants";

export function proxy(request: NextRequest) {
  const accessGateEnabled = process.env.ACCESS_GATE_ENABLED === "true";
  const { pathname, search } = request.nextUrl;
  const hasAccessCookie = request.cookies.has(AUTH_COOKIE_NAME);

  // The public product is open by default. Deployments that need a private
  // review gate can opt in without changing the product routes.
  if (!accessGateEnabled) return NextResponse.next();

  if (pathname === "/access") {
    if (!hasAccessCookie) return NextResponse.next();
    const destination = safeNextPath(request.nextUrl.searchParams.get("next") ?? undefined);
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (hasAccessCookie) return NextResponse.next();

  const accessUrl = new URL("/access", request.url);
  accessUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
