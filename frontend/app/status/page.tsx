import type { Metadata } from "next";
import { Suspense } from "react";

import { BackendStatus } from "@/components/status/backend-status";

export const metadata: Metadata = {
  title: "Service status",
  robots: { index: false, follow: false },
};

export default function StatusPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold">Service status</h1>
      <Suspense fallback={<p role="status">Checking backend service…</p>}>
        <BackendStatus />
      </Suspense>
    </section>
  );
}
