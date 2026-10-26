import type { ProductSort } from "@/lib/api/catalogue";
import { SLUG_PATTERN } from "@/lib/api/schemas/catalogue";

/**
 * Listing state lives in the URL (?category=&min_price=&max_price=&sort=&page=), so it
 * is shareable and the back button restores it. Anything invalid is normalised to a
 * default here instead of reaching the backend as a 422.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SORT_OPTIONS: ReadonlyArray<{ value: ProductSort; label: string }> = [
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
];
export const DEFAULT_SORT: ProductSort = "name_asc";
export const LISTING_PAGE_SIZE = 24;
const MAX_PAGE = 10_000;
const PRICE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export interface ListingParams {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort: ProductSort;
  page: number;
  /** Set when the price range had to be corrected, so the page can say so. */
  notice?: string;
}

function first(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

function price(value: string | string[] | undefined): string | undefined {
  const text = first(value);
  return text && PRICE_PATTERN.test(text) ? text : undefined;
}

export function parseListingParams(raw: RawSearchParams): ListingParams {
  const category = first(raw.category);
  const sortText = first(raw.sort);
  const sort = SORT_OPTIONS.find((option) => option.value === sortText)?.value ?? DEFAULT_SORT;
  const pageNumber = Number(first(raw.page));
  const page =
    Number.isInteger(pageNumber) && pageNumber >= 1 ? Math.min(pageNumber, MAX_PAGE) : 1;

  let minPrice = price(raw.min_price);
  let maxPrice = price(raw.max_price);
  let notice: string | undefined;
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
    notice = "The minimum price was higher than the maximum, so the two were swapped.";
  }

  return {
    ...(category && SLUG_PATTERN.test(category) ? { category } : {}),
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    sort,
    page,
    ...(notice ? { notice } : {}),
  };
}

/** True when any filter (not sort or page) is applied. */
export function hasFilters(params: ListingParams): boolean {
  return Boolean(params.category || params.minPrice || params.maxPrice);
}

/** URL for `basePath` with the given state; defaults are left out to keep URLs short. */
export function listingHref(
  basePath: string,
  params: Partial<Omit<ListingParams, "notice">>,
): string {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.minPrice) search.set("min_price", params.minPrice);
  if (params.maxPrice) search.set("max_price", params.maxPrice);
  if (params.sort && params.sort !== DEFAULT_SORT) search.set("sort", params.sort);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const text = search.toString();
  return text ? `${basePath}?${text}` : basePath;
}
