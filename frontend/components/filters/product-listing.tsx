import Link from "next/link";

import { type CategoryOption, FilterPanel } from "@/components/filters/filter-panel";
import { Pagination } from "@/components/filters/pagination";
import { SortSelect } from "@/components/filters/sort-select";
import { DevDataBanner } from "@/components/layout/dev-data-banner";
import { ProductGrid } from "@/components/product/product-grid";
import { getProducts } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import type { ProductPage } from "@/lib/api/schemas/catalogue";
import { LISTING_PAGE_SIZE, type ListingParams, hasFilters, listingHref } from "@/lib/listing";

export const LISTING_UNAVAILABLE =
  "Products are temporarily unavailable. Please try again shortly.";

function resultCount(total: number): string {
  return `${total} ${total === 1 ? "product" : "products"}`;
}

/**
 * Filters, sort, results and pagination for /products and /categories/[slug].
 * `fixedCategory` is set on category pages, where the category filter is not offered.
 */
export async function ProductListing({
  basePath,
  params,
  categories,
  fixedCategory,
}: {
  basePath: string;
  params: ListingParams;
  categories?: CategoryOption[];
  fixedCategory?: string;
}) {
  let page: ProductPage;
  try {
    page = await getProducts({
      category: fixedCategory ?? params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort: params.sort,
      page: params.page,
      pageSize: LISTING_PAGE_SIZE,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`product_listing_failed kind=${error.kind} status=${error.status ?? "-"}`);
    return (
      <p role="status" className="rounded-md border px-4 py-3 text-muted-foreground">
        {LISTING_UNAVAILABLE}
      </p>
    );
  }

  // Keyed by the URL state so the uncontrolled fields follow back/forward navigation.
  const stateKey = listingHref(basePath, params);
  const clearHref = listingHref(basePath, { sort: params.sort });
  const beyondLastPage = page.items.length === 0 && page.total > 0;

  return (
    <div className="space-y-6">
      <DevDataBanner items={page.items} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <FilterPanel key={`filters:${stateKey}`} basePath={basePath} params={params} categories={categories} />
        <SortSelect key={`sort:${stateKey}`} basePath={basePath} params={params} />
      </div>
      {params.notice ? (
        <p className="rounded-md border border-amber-600 px-4 py-2 text-sm">{params.notice}</p>
      ) : null}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {resultCount(page.total)}
      </p>
      {page.items.length > 0 ? (
        <ProductGrid products={page.items} />
      ) : (
        <div className="space-y-2 rounded-md border px-4 py-6">
          <p>
            {beyondLastPage
              ? "This page has no products."
              : "No products match these filters."}
          </p>
          {beyondLastPage ? (
            <Link href={listingHref(basePath, { ...params, page: 1 })} className="text-sm underline">
              Go to the first page
            </Link>
          ) : hasFilters(params) ? (
            <Link href={clearHref} className="text-sm underline">
              Clear filters
            </Link>
          ) : null}
        </div>
      )}
      <Pagination
        page={params.page}
        total={page.total}
        pageSize={LISTING_PAGE_SIZE}
        hrefFor={(target) => listingHref(basePath, { ...params, page: target })}
      />
    </div>
  );
}
