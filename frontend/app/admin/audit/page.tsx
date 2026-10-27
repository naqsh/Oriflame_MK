import { connection } from "next/server";
import { Suspense } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import { AuditTable } from "@/components/admin/audit-table";
import { adminRequest } from "@/lib/admin/api";
import { pageParam } from "@/lib/admin/format";
import { auditPageSchema } from "@/lib/admin/schemas";

const PAGE_SIZE = 25;

async function AuditContent({ searchParams }: PageProps<"/admin/audit">) {
  await connection();
  const page = pageParam((await searchParams).page);
  const data = await adminRequest(`/audit-logs?page=${page}&page_size=${PAGE_SIZE}`, auditPageSchema);
  return <AuditTable data={data} />;
}

export default function AdminAuditPage(props: PageProps<"/admin/audit">) {
  return (
    <section className="space-y-6">
      <AdminHeader title="Audit log" />
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <AuditContent {...props} />
      </Suspense>
    </section>
  );
}
