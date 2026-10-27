import { connection } from "next/server";
import { Suspense } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import { ReferralClicksTable, ReferralStatusCard } from "@/components/admin/referral-overview";
import { adminRequest } from "@/lib/admin/api";
import { referralClicksSchema, referralSetupSchema } from "@/lib/admin/schemas";

async function ReferralContent() {
  await connection();
  const [setup, clicks] = await Promise.all([
    adminRequest("/referral-status", referralSetupSchema),
    adminRequest("/referral-clicks", referralClicksSchema),
  ]);
  return (
    <>
      <ReferralStatusCard setup={setup} />
      <ReferralClicksTable clicks={clicks} />
    </>
  );
}

export default function AdminReferralPage() {
  return (
    <section className="space-y-6">
      <AdminHeader title="Referral" />
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ReferralContent />
      </Suspense>
    </section>
  );
}
