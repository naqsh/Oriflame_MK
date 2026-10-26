import { ApiError, fetchJson } from "@/lib/api/client";
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
    min_price: params.minPrice,
    max_price: params.maxPrice,
    sort: params.sort,
    page: params.page,
    page_size: params.pageSize,
  });
  return fetchJson(`/api/v1/products${query}`, productPageSchema);
}

/** Resolve to null on 404, so pages can call notFound(). Other failures throw. */
async function orNotFound<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** GET /api/v1/products/{slug}. Null for unknown, hidden or malformed slugs. */
export function getProduct(slug: string): Promise<ProductDetail | null> {
  if (!SLUG_PATTERN.test(slug)) return Promise.resolve(null);
  return orNotFound(() => fetchJson(`/api/v1/products/${slug}`, productDetailSchema));
}

/** GET /api/v1/categories: the full tree with visible product counts. */
export function getCategories(): Promise<CategoryTree> {
  return fetchJson("/api/v1/categories", categoryTreeSchema);
}

/** GET /api/v1/categories/{slug}. Null for unknown or malformed slugs. */
export function getCategory(slug: string): Promise<CategoryDetail | null> {
  if (!SLUG_PATTERN.test(slug)) return Promise.resolve(null);
  return orNotFound(() => fetchJson(`/api/v1/categories/${slug}`, categoryDetailSchema));
}

/** GET /api/v1/search. The backend trims q and requires 1 to 100 characters. */
export function searchProducts({ q, page, pageSize }: SearchParams): Promise<ProductPage> {
  const query = queryString({ q, page, page_size: pageSize });
  return fetchJson(`/api/v1/search${query}`, searchResultSchema);
}
