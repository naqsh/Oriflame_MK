import { fetchJson, orNotFound } from "@/lib/api/client";
import { type ProductDetail, SLUG_PATTERN, productDetailSchema } from "@/lib/api/schemas/catalogue";

/**
 * GET /api/v1/products/{slug} from the browser, uncached, so the shopping list compares
 * against current data. Null for unknown, hidden or malformed slugs.
 */
export function checkProduct(slug: string): Promise<ProductDetail | null> {
  if (!SLUG_PATTERN.test(slug)) return Promise.resolve(null);
  return orNotFound(() => fetchJson(`/api/v1/products/${slug}`, productDetailSchema));
}
