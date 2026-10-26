import { z } from "zod";

import { fetchJson } from "@/lib/api/client";

/**
 * Zod schema for an API response, mirroring the backend's Pydantic model.
 * A condensed version of frontend/lib/api/schemas/catalogue.ts (OR-022).
 *
 * - The schema is the single source of the TypeScript type (z.infer).
 * - Decimals arrive as strings ("1499.00") so no precision is lost; null is meaningful.
 * - Timestamps must carry a timezone; URLs must be http(s).
 * - Unknown fields are stripped; missing or wrong fields make fetchJson throw
 *   ApiError("invalid_response"), which pages turn into a friendly notice.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const itemSchema = z.object({
  slug: z.string().regex(SLUG_PATTERN),
  name: z.string().min(1),
  price_pkr: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/)
    .nullable(),
  source_url: z.url({ protocol: /^https?$/ }),
  last_synced_at: z.iso.datetime({ offset: true }),
});

export const itemPageSchema = z.object({
  items: z.array(itemSchema),
  total: z.int().nonnegative(),
  page: z.int().positive(),
  page_size: z.int().positive(),
});

export type Item = z.infer<typeof itemSchema>;
export type ItemPage = z.infer<typeof itemPageSchema>;

/** Typed API call: the return type comes from the schema. */
export function getItems(page = 1): Promise<ItemPage> {
  const query = new URLSearchParams({ page: String(page) });
  return fetchJson(`/api/v1/items?${query}`, itemPageSchema);
}
