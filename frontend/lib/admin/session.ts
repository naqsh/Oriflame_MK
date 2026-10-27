import { cookies } from "next/headers";

import { ADMIN_COOKIE, ADMIN_PATH } from "@/lib/admin/constants";

/**
 * The admin session cookie (ADR-003). HttpOnly and SameSite=Strict, scoped to /admin and
 * set only by Server Actions; the token inside is sent to the API as a bearer token by
 * the Next.js server and never exposed to client JavaScript.
 */

export async function getAdminToken(): Promise<string | null> {
  return (await cookies()).get(ADMIN_COOKIE)?.value ?? null;
}

export async function setAdminSession(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: ADMIN_PATH,
    expires: expiresAt,
  });
}

export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: ADMIN_PATH });
}
