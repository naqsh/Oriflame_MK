import { z } from "zod";

import { fetchJson, postJson } from "@/lib/api/client";

/**
 * Referral handoff (OR-032, ADR-002). The destination always comes from the server;
 * the client only says where the click came from. Mirrors backend/app/schemas/referral.py.
 */

const httpsUrl = z.url({ protocol: /^https$/ });

export const handoffSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("official_url"), url: httpsUrl, note: z.string().min(1) }),
  z.object({
    method: z.literal("manual_code"),
    code: z.string().min(1),
    instructions: z.array(z.string().min(1)).min(1),
    checkout_url: httpsUrl,
  }),
  z.object({
    method: z.literal("unavailable"),
    reason: z.enum(["not_configured", "invalid"]),
    message: z.string().min(1),
    fallback_url: httpsUrl,
  }),
]);

export const referralModeSchema = z.object({
  method: z.enum(["official_url", "manual_code", "unavailable"]),
});

export type Handoff = z.infer<typeof handoffSchema>;
export type ReferralMethod = z.infer<typeof referralModeSchema>["method"];
export type HandoffOrigin = "pdp" | "list" | "referral_page";

export interface HandoffRequest {
  origin: HandoffOrigin;
  productSlug?: string;
  itemCount?: number;
}

/** POST /api/v1/referral/handoff: records an anonymous click and returns the handoff. */
export function requestHandoff({ origin, productSlug, itemCount = 0 }: HandoffRequest) {
  return postJson(
    "/api/v1/referral/handoff",
    { origin, product_slug: productSlug ?? null, item_count: Math.min(200, Math.max(0, itemCount)) },
    handoffSchema,
  );
}

/** GET /api/v1/referral/mode: only the method, never the code or URL. */
export async function getReferralMode(): Promise<ReferralMethod> {
  return (await fetchJson("/api/v1/referral/mode", referralModeSchema)).method;
}
