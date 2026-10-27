"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Logs Core Web Vitals to the browser console. Loaded only in development by
 * ./web-vitals.tsx: no analytics endpoint is approved, so nothing is sent anywhere.
 */
export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    console.info(`web-vital ${metric.name}=${Math.round(metric.value * 100) / 100} rating=${metric.rating}`);
  });
  return null;
}
