import type { RawSearchParams } from "@/lib/listing";

/** Same limit as the backend's SearchQuery.q (1 to 100 characters after trimming). */
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_PAGE_SIZE = 24;
const MAX_PAGE = 10_000;

export interface SearchState {
  /** Trimmed and cut to SEARCH_MAX_LENGTH; empty means "no search yet". */
  q: string;
  page: number;
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseSearchParams(raw: RawSearchParams): SearchState {
  const q = first(raw.q).trim().slice(0, SEARCH_MAX_LENGTH).trim();
  const pageNumber = Number(first(raw.page));
  const page =
    Number.isInteger(pageNumber) && pageNumber >= 1 ? Math.min(pageNumber, MAX_PAGE) : 1;
  return { q, page };
}

export function searchHref({ q, page }: SearchState): string {
  const search = new URLSearchParams({ q });
  if (page > 1) search.set("page", String(page));
  return `/search?${search.toString()}`;
}
