"use server";

import { redirect } from "next/navigation";

import { forwardedFor } from "@/lib/admin/api";
import {
  INVALID_LOGIN,
  LOGIN_UNAVAILABLE,
  type LoginState,
  TOO_MANY_ATTEMPTS,
} from "@/lib/admin/constants";
import { loginFormSchema, loginResponseSchema } from "@/lib/admin/schemas";
import { clearAdminSession, getAdminToken, setAdminSession } from "@/lib/admin/session";
import { getApiBaseUrl } from "@/lib/api/client";

/**
 * Admin Server Actions (ADR-003). Next.js rejects a Server Action whose Origin does not
 * match the host, and the session cookie is SameSite=Strict: together, the CSRF defence
 * for every state-changing admin request made from the browser.
 */

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").slice(0, 254);
  const parsed = loginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      email,
      fieldErrors: { email: errors.email?.[0], password: errors.password?.[0] },
    };
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/admin/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(await forwardedFor()),
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error("admin_login_unavailable kind=network");
    return { error: LOGIN_UNAVAILABLE, email };
  }
  if (response.status === 401) return { error: INVALID_LOGIN, email };
  if (response.status === 429) return { error: TOO_MANY_ATTEMPTS, email };
  const body = loginResponseSchema.safeParse(response.ok ? await response.json().catch(() => null) : null);
  if (!body.success) {
    console.error(`admin_login_unavailable kind=http status=${response.status}`);
    return { error: LOGIN_UNAVAILABLE, email };
  }

  await setAdminSession(body.data.token, new Date(body.data.expires_at));
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const token = await getAdminToken();
  if (token) {
    // Best effort: the cookie is cleared even if the API cannot be reached.
    await fetch(`${getApiBaseUrl()}/api/v1/admin/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }).catch(() => console.error("admin_logout_unreachable"));
  }
  await clearAdminSession();
  redirect("/admin/login?reason=signedout");
}
