import type { ReactNode } from "react";

import { CONTENT_LAST_UPDATED, CONTENT_REVIEWED } from "@/lib/content/review";

const LAST_UPDATED_TEXT = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "long",
  timeZone: "Asia/Karachi",
}).format(new Date(`${CONTENT_LAST_UPDATED}T12:00:00Z`));

/** Shared frame for informational and legal pages: one h1, date, review status. */
export function ContentPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated <time dateTime={CONTENT_LAST_UPDATED}>{LAST_UPDATED_TEXT}</time>
        </p>
        {CONTENT_REVIEWED ? null : (
          <p className="rounded-md border border-amber-600 px-3 py-2 text-sm">
            This page is awaiting review by the store owner and may change.
          </p>
        )}
      </header>
      <div className="space-y-4 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
