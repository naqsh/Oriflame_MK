import type { Availability } from "@/lib/api/schemas/catalogue";
import { cn } from "@/lib/utils/cn";

const STYLES: Record<Availability["status"], string> = {
  verified_in_stock: "border-green-700 text-green-800",
  verified_out_of_stock: "border-red-700 text-red-800",
  not_confirmed: "border-border text-muted-foreground",
};

/** Pakistan time, e.g. "27-Oct-2026, 12:00 pm". */
export function formatCheckedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

/** Shows the backend's label as is; the wording is decided server-side (OR-021). */
export function AvailabilityBadge({ availability }: { availability: Availability }) {
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1 rounded border px-2 py-0.5 text-xs",
        STYLES[availability.status],
      )}
    >
      <span>{availability.label}</span>
      {availability.checked_at ? (
        <span>
          (checked{" "}
          <time dateTime={availability.checked_at}>{formatCheckedAt(availability.checked_at)}</time>
          )
        </span>
      ) : null}
    </span>
  );
}
