"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SyncActionState } from "@/lib/admin/constants";
import { getAdminToken } from "@/lib/admin/session";
import { getApiBaseUrl } from "@/lib/api/client";

/** Start a catalogue sync (OR-047). A Server Action, so Next.js checks the Origin. */
export async function startSyncAction(): Promise<SyncActionState> {
  const token = await getAdminToken();
  if (!token) redirect("/admin/login?reason=signin");

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/admin/sync`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, message: "The API could not be reached. Try again shortly." };
  }
  if (response.status === 401) redirect("/admin/login?reason=expired");
  const body: unknown = await response.json().catch(() => null);
  const detail =
    body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
      ? body.detail
      : null;
  if (response.status === 409) return { ok: false, message: detail ?? "The sync cannot start right now." };
  if (response.status !== 202) return { ok: false, message: "The sync could not be started." };
  revalidatePath("/admin/sync");
  return { ok: true, message: "Sync started. Refresh this page to follow its progress." };
}
