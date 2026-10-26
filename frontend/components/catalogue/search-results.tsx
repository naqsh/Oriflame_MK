import Link from "next/link";

import { Pagination } from "@/components/filters/pagination";
import { DevDataBanner } from "@/components/layout/dev-data-banner";
import { ProductGrid } from "@/components/product/product-grid";
import { getCategories, searchProducts } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import type { CategoryNode, ProductPage } from "@/lib/api/schemas/catalogue";
import type { RawSearchParams } from "@/lib/listing";
import {
  SEARCH_MAX_LENGTH,
  SEARCH_PAGE_SIZE,
  parseSearchParams,
  searchHref,
} from "@/lib/search";

export const SEARCH_BUSY = "Search is busy right now. Please try again shortly.";
export const SEARCH_UNAVAILABLE = "Search is temporarily unavailable. Please try again shortly.";
const SUGGESTED_CATEGORIES = 4;

/** Search form with the current query filled in. A plain GET form: no JavaScript needed. */
function SearchForm({ q }: { q: string }) {
  return (
    <form action="/search" method="get" role="search" className="flex max-w-xl gap-2">
      <label htmlFor="search-page-q" className="sr-only">
        Search products
      </label>
      <input
        id="search-page-q"
        name="q"
        type="search"
        required
        maxLength={SEARCH_MAX_LENGTH}
        defaultValue={q}
        className="w-full min-w-0 rounded-md border px-3 py-2"
      />
      <button type="submit" className="rounded-md border px-4 py-2 font-medium">
        Search
      </button>
    </form>
  );
}

/** The categories with the most products, offered when a search finds nothing. */
async function popularCategories(): Promise<CategoryNode[]> {
  try {
    return [...(await getCategories()).items]
      .filter((category) => category.product_count > 0)
      .sort((a, b) => b.product_count - a.product_count)
      .slice(0, SUGGESTED_CATEGORIES);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return [];
  }
}

function Notice({ children }: { children: string }) {
  return (
    <p role="status" className="rounded-md border px-4 py-3 text-muted-foreground">
      {children}
    </p>
  );
}

/** Body of /search. Text the visitor typed is only ever rendered as React text. */
export async function SearchResults({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const state = parseSearchParams(await searchParams);

  if (!state.q) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl font-semibold">Search products</h1>
        <SearchForm q="" />
        <p className="text-muted-foreground">Enter a product name or a word from its description.</p>
      </div>
    );
  }

  let results: ProductPage | null = null;
  let failure: string | null = null;
  try {
    results = await searchProducts({ q: state.q, page: state.page, pageSize: SEARCH_PAGE_SIZE });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`search_failed kind=${error.kind} status=${error.status ?? "-"}`);
    failure = error.status === 429 ? SEARCH_BUSY : SEARCH_UNAVAILABLE;
  }

  const suggestions = results && results.total === 0 ? await popularCategories() : [];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">
        Search results for &ldquo;{state.q}&rdquo;
      </h1>
      <SearchForm q={state.q} />
      {failure ? <Notice>{failure}</Notice> : null}
      {results ? (
        <>
          <DevDataBanner items={results.items} />
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {results.total} {results.total === 1 ? "result" : "results"}
          </p>
          {results.items.length > 0 ? (
            <ProductGrid products={results.items} />
          ) : results.total > 0 ? (
            <p>
              This page has no results.{" "}
              <Link href={searchHref({ q: state.q, page: 1 })} className="underline">
                Go to the first page
              </Link>
            </p>
          ) : (
            <div className="space-y-3 rounded-md border px-4 py-6">
              <p>No products matched your search. Try a shorter or different word.</p>
              {suggestions.length > 0 ? (
                <nav aria-label="Popular categories">
                  <p className="text-sm font-medium">Or browse a popular category:</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {suggestions.map((category) => (
                      <li key={category.slug}>
                        <Link
                          href={`/categories/${category.slug}`}
                          className="inline-block rounded-full border px-3 py-1 text-sm hover:border-foreground"
                        >
                          {category.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
              <Link href="/products" className="inline-block text-sm underline">
                Browse all products
              </Link>
            </div>
          )}
          <Pagination
            page={state.page}
            total={results.total}
            pageSize={SEARCH_PAGE_SIZE}
            hrefFor={(page) => searchHref({ q: state.q, page })}
          />
        </>
      ) : null}
    </div>
  );
}
