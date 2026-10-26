"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { type ListingParams, listingHref } from "@/lib/listing";

export interface CategoryOption {
  slug: string;
  label: string;
}

/**
 * Category and price filters. A plain GET form, so it also works without JavaScript;
 * with JavaScript it navigates client-side. Applying filters always returns to page 1.
 * The parent passes a `key` built from the URL so the fields follow back/forward.
 */
export function FilterPanel({
  basePath,
  params,
  categories,
}: {
  basePath: string;
  params: ListingParams;
  categories?: CategoryOption[];
}) {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    router.push(
      listingHref(basePath, {
        category: categories ? text("category") : undefined,
        minPrice: text("min_price"),
        maxPrice: text("max_price"),
        sort: params.sort,
      }),
    );
  }

  return (
    <form
      action={basePath}
      method="get"
      onSubmit={onSubmit}
      aria-label="Filter products"
      className="flex flex-wrap items-end gap-3"
    >
      {categories ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="filter-category"
            name="category"
            defaultValue={params.category ?? ""}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-min-price" className="text-sm font-medium">
          Min price (Rs)
        </label>
        <input
          id="filter-min-price"
          name="min_price"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={params.minPrice ?? ""}
          className="w-28 rounded-md border px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-max-price" className="text-sm font-medium">
          Max price (Rs)
        </label>
        <input
          id="filter-max-price"
          name="max_price"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={params.maxPrice ?? ""}
          className="w-28 rounded-md border px-2 py-1.5 text-sm"
        />
      </div>
      {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
      <button type="submit" className="rounded-md border px-3 py-1.5 text-sm font-medium">
        Apply filters
      </button>
    </form>
  );
}
