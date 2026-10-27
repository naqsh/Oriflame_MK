import Link from "next/link";

import type { AuditPage } from "@/lib/admin/schemas";
import { formatDateTime } from "@/lib/admin/format";

function describeDetails(details: Record<string, unknown>): string {
  const parts = Object.entries(details).map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Recent admin actions, newest first, with previous/next paging. */
export function AuditTable({ data }: { data: AuditPage }) {
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  if (data.items.length === 0) return <p>No admin actions recorded yet.</p>;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Admin actions, newest first</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-4">When (PKT)</th>
              <th scope="col" className="py-2 pr-4">Action</th>
              <th scope="col" className="py-2 pr-4">Admin</th>
              <th scope="col" className="py-2 pr-4">Target</th>
              <th scope="col" className="py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((entry) => (
              <tr key={entry.id} className="border-b align-top">
                <td className="py-2 pr-4 whitespace-nowrap">
                  <time dateTime={entry.occurred_at}>{formatDateTime(entry.occurred_at)}</time>
                </td>
                <td className="py-2 pr-4 font-mono">{entry.action}</td>
                <td className="py-2 pr-4">{entry.admin_user_id === null ? "—" : `#${entry.admin_user_id}`}</td>
                <td className="py-2 pr-4">
                  {entry.target_type ? `${entry.target_type} ${entry.target_id ?? ""}`.trim() : "—"}
                </td>
                <td className="py-2">{describeDetails(entry.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Audit log pages" className="flex items-center gap-4 text-sm">
        {data.page > 1 ? <Link href={`/admin/audit?page=${data.page - 1}`}>← Newer</Link> : null}
        <span>
          Page {data.page} of {pages}
        </span>
        {data.page < pages ? <Link href={`/admin/audit?page=${data.page + 1}`}>Older →</Link> : null}
      </nav>
    </div>
  );
}
