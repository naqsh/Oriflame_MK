"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Logs Core Web Vitals to the browser console. Rendered only in development (see
 * app/layout.tsx): no analytics endpoint is approved, so nothing is sent anywhere.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    console.info(`web-vital ${metric.name}=${Math.round(metric.value * 100) / 100} rating=${metric.rating}`);
  });
  return null;
}
