import { formatDateTime } from "@/lib/admin/format";
import type { SyncRuns } from "@/lib/admin/schemas";

const STATUS_LABEL = {
  running: "Running",
  success: "Success",
  failed: "Failed",
  partial: "Partial",
} as const;

/** Human age of the last successful sync, e.g. "3 hours ago". */
export function syncAge(lastSuccess: string | null, now: Date = new Date()): string {
  if (!lastSuccess) return "No successful sync yet";
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(lastSuccess).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function SyncRunsTable({ data }: { data: SyncRuns }) {
  if (data.items.length === 0) return <p>No sync has run yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Catalogue sync runs, newest first</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-2 pr-4">Started (PKT)</th>
            <th scope="col" className="py-2 pr-4">Status</th>
            <th scope="col" className="py-2 pr-4">Source</th>
            <th scope="col" className="py-2 pr-4">Created / updated / unchanged / errors</th>
            <th scope="col" className="py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((run) => (
            <tr key={run.id} className="border-b align-top">
              <td className="py-2 pr-4 whitespace-nowrap">
                <time dateTime={run.started_at}>{formatDateTime(run.started_at)}</time>
              </td>
              <td className="py-2 pr-4">{STATUS_LABEL[run.status]}</td>
              <td className="py-2 pr-4 font-mono">{run.source}</td>
              <td className="py-2 pr-4">
                {run.created_count} / {run.updated_count} / {run.unchanged_count} / {run.error_count}
              </td>
              <td className="py-2 break-words">{run.error_detail ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
