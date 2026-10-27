"use client";

import dynamic from "next/dynamic";

/**
 * Development-only Web Vitals logging (OR-042). The condition is a build-time constant,
 * so production builds drop the reporter and the web-vitals library entirely; only this
 * empty wrapper ships. (A dynamic import from the Server Component layout does not work
 * under `next dev`, so the switch lives here.)
 */
const Reporter =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/components/status/web-vitals-reporter"), { ssr: false })
    : null;

export function WebVitals() {
  return Reporter ? <Reporter /> : null;
}
