import { connection } from "next/server";

import { ApiError } from "@/lib/api/client";
import { type ReferralMethod, getReferralMode } from "@/lib/api/referral";

/** How buying works, for the store's current handoff method (OR-034). */
export function ReferralSteps({ method }: { method: ReferralMethod | null }) {
  const steps = [
    "Browse products here and keep a shopping list in your browser. No account is needed.",
    "Select “Buy from Oriflame” to continue on Oriflame's official Pakistan website.",
    ...(method === "manual_code"
      ? ["When Oriflame asks for a consultant or Brand Partner code, enter the code we show you."]
      : []),
    "Add your products there, then check out, pay and arrange delivery with Oriflame.",
  ];
  return (
    <ol className="list-decimal space-y-2 pl-5">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

/** Reads the method per request; without it the generic steps are shown. */
export async function CurrentReferralSteps() {
  await connection();
  let method: ReferralMethod | null = null;
  try {
    method = await getReferralMode();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`referral_mode_failed kind=${error.kind} status=${error.status ?? "-"}`);
  }
  return <ReferralSteps method={method} />;
}
