import { connection } from "next/server";

import { getBackendStatus } from "@/lib/api/health";

const LABELS = {
  healthy: "Backend service: healthy",
  unavailable: "Backend service: unavailable. Please try again shortly.",
} as const;

/** Server Component: checks the backend on each request (never prerendered at build). */
export async function BackendStatus() {
  await connection();
  const status = await getBackendStatus();

  return (
    <p role="status" data-status={status}>
      {LABELS[status]}
    </p>
  );
}
