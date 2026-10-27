import type { ReferralClicks, ReferralSetup } from "@/lib/admin/schemas";

const STATUS_TEXT = {
  configured: "Configured",
  not_configured: "Not configured: visitors get a plain link to Oriflame (restricted mode)",
  invalid: "Invalid settings: visitors get a plain link to Oriflame until fixed",
} as const;

const METHOD_TEXT: Record<string, string> = {
  official_url: "Official referral link",
  manual_code: "Consultant code (copied by visitors)",
};

const ORIGIN_TEXT: Record<string, string> = {
  pdp: "Product pages",
  list: "Shopping list",
  referral_page: "How buying works page",
};

/** Read-only referral setup: changes are made in deployment environment settings. */
export function ReferralStatusCard({ setup }: { setup: ReferralSetup }) {
  return (
    <section aria-labelledby="referral-setup" className="space-y-2 rounded-lg border p-4">
      <h2 id="referral-setup" className="font-heading text-xl font-semibold">
        Referral setup
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-medium">Status</dt>
        <dd>{STATUS_TEXT[setup.status]}</dd>
        <dt className="font-medium">Method</dt>
        <dd>{METHOD_TEXT[setup.method] ?? setup.method}</dd>
        {setup.referral_host ? (
          <>
            <dt className="font-medium">Referral host</dt>
            <dd className="font-mono">{setup.referral_host}</dd>
          </>
        ) : null}
        {setup.masked_code ? (
          <>
            <dt className="font-medium">Consultant code</dt>
            <dd className="font-mono">{setup.masked_code}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-sm text-muted-foreground">
        Referral settings are managed through deployment environment settings (the referral
        method, link and consultant code; see <code>infrastructure/DEPLOYMENT.md</code>). They
        cannot be edited here.
      </p>
    </section>
  );
}

/** Daily handoff clicks: visitors sent to Oriflame. Not sales or conversions. */
export function ReferralClicksTable({ clicks }: { clicks: ReferralClicks }) {
  const origins = Object.entries(clicks.by_origin)
    .map(([origin, count]) => `${ORIGIN_TEXT[origin] ?? origin}: ${count}`)
    .join(", ");
  const activeDays = clicks.days.filter((day) => day.total > 0);
  return (
    <section aria-labelledby="handoff-clicks" className="space-y-3">
      <h2 id="handoff-clicks" className="font-heading text-xl font-semibold">
        Handoff clicks
      </h2>
      <p className="text-sm text-muted-foreground">
        Times visitors selected &ldquo;Buy from Oriflame&rdquo;, {clicks.start} to {clicks.end}{" "}
        (Pakistan time). These are clicks, not sales: orders are placed on Oriflame and are not
        visible here.
      </p>
      <p>
        Total: <strong>{clicks.total}</strong>
        {origins ? ` (${origins})` : null}
      </p>
      {activeDays.length === 0 ? (
        <p className="text-sm">No handoff clicks in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Handoff clicks per day</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-1 pr-4">Day</th>
                <th scope="col" className="py-1 pr-4">Clicks</th>
                <th scope="col" className="py-1">By method</th>
              </tr>
            </thead>
            <tbody>
              {activeDays.map((day) => (
                <tr key={day.day} className="border-b">
                  <td className="py-1 pr-4">{day.day}</td>
                  <td className="py-1 pr-4">{day.total}</td>
                  <td className="py-1">
                    {Object.entries(day.by_method)
                      .map(([method, count]) => `${METHOD_TEXT[method] ?? method}: ${count}`)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
