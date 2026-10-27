import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE, LOGIN_PATH } from "@/lib/admin/constants";

/**
 * Fast redirect for signed-out visitors to /admin/* (OR-045). This is a convenience, not
 * the protection: admin pages check the session with the API on every request, and the
 * API rejects any admin call without a valid bearer token.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === LOGIN_PATH) return NextResponse.next();
  if (request.cookies.has(ADMIN_COOKIE)) return NextResponse.next();
  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set("reason", "signin");
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
