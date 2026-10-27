import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { ApiError, DEFAULT_TIMEOUT_MS, getApiBaseUrl } from "@/lib/api/client";
import { LOGIN_PATH } from "@/lib/admin/constants";
import { adminMeSchema, type AdminMe } from "@/lib/admin/schemas";
import { getAdminToken } from "@/lib/admin/session";

/**
 * The visitor's address as this server saw it, forwarded so the API can rate-limit
 * logins per client. The API only trusts it from configured proxies (OR-050).
 */
export async function forwardedFor(): Promise<Record<string, string>> {
  const h = await headers();
  const address = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return address ? { "X-Forwarded-For": address } : {};
}

interface AdminRequest {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string | null;
}

/**
 * Call an admin API route from the server with the session's bearer token and validate
 * the JSON response. A 401 (missing, expired or revoked session) sends the admin to the
 * login page; nothing partial is rendered.
 */
export async function adminRequest<Schema extends z.ZodType>(
  path: string,
  schema: Schema | null,
  { method = "GET", body, token }: AdminRequest = {},
): Promise<z.infer<Schema>> {
  const bearer = token === undefined ? await getAdminToken() : token;
  if (!bearer) redirect(`${LOGIN_PATH}?reason=signin`);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/admin${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ApiError("network", `${method} admin${path} failed: ${String(error)}`);
  }
  if (response.status === 401) redirect(`${LOGIN_PATH}?reason=expired`);
  if (!response.ok) {
    throw new ApiError("http", `${method} admin${path} returned ${response.status}`, response.status);
  }
  if (schema === null || response.status === 204) return undefined as z.infer<Schema>;
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiError("invalid_response", `${method} admin${path} did not match schema`, response.status);
  }
  return parsed.data;
}

/** The signed-in admin, or a redirect to the login page. Call at the top of admin pages. */
export function requireAdmin(): Promise<AdminMe> {
  return adminRequest("/me", adminMeSchema);
}
