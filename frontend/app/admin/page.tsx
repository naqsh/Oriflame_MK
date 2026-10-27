import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { logoutAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin/api";

const ADMIN_SECTIONS = [
  { href: "/admin/sync", label: "Catalogue sync", description: "Sync health and a manual sync." },
  { href: "/admin/referral", label: "Referral", description: "Referral setup and handoff clicks." },
  { href: "/admin/audit", label: "Audit log", description: "Recent admin actions." },
] as const;

async function Dashboard() {
  await connection();
  const admin = await requireAdmin();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Signed in as {admin.email}</p>
        <form action={logoutAction}>
          <button type="submit" className="rounded-md border px-3 py-1 text-sm">
            Sign out
          </button>
        </form>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {ADMIN_SECTIONS.map((section) => (
          <li key={section.href} className="rounded-lg border p-4">
            <Link href={section.href} className="font-medium underline">
              {section.label}
            </Link>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function AdminPage() {
  return (
    <section className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">Admin</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </section>
  );
}
