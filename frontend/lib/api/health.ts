import { ApiError, fetchJson } from "@/lib/api/client";
import { healthResponseSchema } from "@/lib/api/schemas/health";

export type BackendStatus = "healthy" | "unavailable";

/** Liveness of the FastAPI backend. Failures are logged server-side, never shown raw. */
export async function getBackendStatus(): Promise<BackendStatus> {
  try {
    await fetchJson("/health", healthResponseSchema);
    return "healthy";
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`backend_health_check_failed kind=${error.kind} status=${error.status ?? "-"}`);
    return "unavailable";
  }
}
