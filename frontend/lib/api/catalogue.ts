import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";

import { CATALOGUE_CACHE_TAG } from "@/lib/admin/constants";
import {
  ApiError,
  type ApiErrorKind,
  fetchJson,
  orNotFound,
  readJson,
  validateBody,
} from "@/lib/api/client";
import {
  type CategoryDetail,
  type CategoryTree,
  type ProductDetail,
  type ProductPage,
  SLUG_PATTERN,
  categoryDetailSchema,
  categoryTreeSchema,
  productDetailSchema,
  productPageSchema,
  searchResultSchema,
} from "@/lib/api/schemas/catalogue";

export type ProductSort = "name_asc" | "name_desc" | "price_asc" | "price_desc" | "newest";

export interface ProductListParams {
  category?: string;
  featured?: boolean;
  minPrice?: string;
  maxPrice?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export interface SearchParams {
  q: string;
  page?: number;
  pageSize?: number;
}

/**
 * Server-only: "use cache" cannot run in Client Components. The browser checks live
 * product data through lib/api/product-check.ts instead.
 *
 * Catalogue data only changes when a sync runs, so reads are cached on the server
 * across requests (in memory, per server process). Listing pages otherwise pay one
 * API round trip per call on every request. A visitor sees a sync's changes within
 * CATALOGUE_CACHE.revalidate seconds. Search is not cached: its keys are visitor input.
 */
export const CATALOGUE_CACHE = { stale: 300, revalidate: 600, expire: 3600 } as const;

/** Failures must not outlive the request that saw them. */
const FAILURE_CACHE = { stale: 0, revalidate: 1, expire: 2 } as const;

/** Plain data, so it survives the cache's serialisation (an ApiError instance would not). */
type CachedRead =
  | { ok: true; body: unknown }
  | { ok: false; kind: ApiErrorKind; message: string; status: number | undefined };

async function cachedRead(path: string): Promise<CachedRead> {
  "use cache";
  // The admin product actions expire this tag, so owner changes show at once.
  cacheTag(CATALOGUE_CACHE_TAG);
  try {
    const body = await readJson(path);
    cacheLife(CATALOGUE_CACHE);
    return { ok: true, body };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // A 404 is a stable answer (unknown or hidden slug); anything else is transient.
    cacheLife(error.status === 404 ? CATALOGUE_CACHE : FAILURE_CACHE);
    return { ok: false, kind: error.kind, message: error.message, status: error.status };
  }
}

/** Cached GET of `path`, validated with `schema` after the cache (schemas are not serialisable). */
async function fetchCatalogue<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const result = await cachedRead(path);
  if (!result.ok) throw new ApiError(result.kind, result.message, result.status);
  return validateBody(`GET ${path}`, schema, result.body);
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** GET /api/v1/products: visible products, filtered, sorted and paginated. */
export function getProducts(params: ProductListParams = {}): Promise<ProductPage> {
  const query = queryString({
    category: params.category,
    featured: params.featured === undefined ? undefined : String(params.featured),
    min_price: params.minPrice,
    max_price: params.maxPrice,
    sort: params.sort,
    page: params.page,
    page_size: params.pageSize,
  });
  return fetchCatalogue(`/api/v1/products${query}`, productPageSchema);
}

/** GET /api/v1/products/{slug}. Null for unknown, hidden or malformed slugs. */
export function getProduct(slug: string): Promise<ProductDetail | null> {
  if (!SLUG_PATTERN.test(slug)) return Promise.resolve(null);
  return orNotFound(() => fetchCatalogue(`/api/v1/products/${slug}`, productDetailSchema));
}

/** GET /api/v1/categories: the full tree with visible product counts. */
export function getCategories(): Promise<CategoryTree> {
  return fetchCatalogue("/api/v1/categories", categoryTreeSchema);
}

/** GET /api/v1/categories/{slug}. Null for unknown or malformed slugs. */
export function getCategory(slug: string): Promise<CategoryDetail | null> {
  if (!SLUG_PATTERN.test(slug)) return Promise.resolve(null);
  return orNotFound(() => fetchCatalogue(`/api/v1/categories/${slug}`, categoryDetailSchema));
}

/** GET /api/v1/search. The backend trims q and requires 1 to 100 characters. */
export function searchProducts({ q, page, pageSize }: SearchParams): Promise<ProductPage> {
  const query = queryString({ q, page, page_size: pageSize });
  return fetchJson(`/api/v1/search${query}`, searchResultSchema);
}
