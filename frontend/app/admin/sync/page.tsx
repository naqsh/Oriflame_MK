import { connection } from "next/server";
import { Suspense } from "react";

import { startSyncAction } from "@/app/admin/sync/actions";
import { AdminHeader } from "@/components/admin/admin-header";
import { RunSyncButton } from "@/components/admin/run-sync-button";
import { SyncRunsTable, syncAge } from "@/components/admin/sync-runs-table";
import { adminRequest } from "@/lib/admin/api";
import { syncRunsSchema } from "@/lib/admin/schemas";

async function SyncContent() {
  await connection();
  const data = await adminRequest("/sync-runs?page=1&page_size=20", syncRunsSchema);
  return (
    <>
      <p>
        Last successful sync: <strong>{syncAge(data.last_success_at)}</strong>
      </p>
      <RunSyncButton action={startSyncAction} />
      <SyncRunsTable data={data} />
    </>
  );
}

export default function AdminSyncPage() {
  return (
    <section className="space-y-6">
      <AdminHeader title="Catalogue sync" />
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <SyncContent />
      </Suspense>
    </section>
  );
}
