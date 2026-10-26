"use client";

import { useRouter } from "next/navigation";

import type { ProductSort } from "@/lib/api/catalogue";
import { type ListingParams, SORT_OPTIONS, listingHref } from "@/lib/listing";

/** Changing the sort keeps the filters and returns to page 1. */
export function SortSelect({ basePath, params }: { basePath: string; params: ListingParams }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-products" className="text-sm font-medium">
        Sort by
      </label>
      <select
        id="sort-products"
        defaultValue={params.sort}
        onChange={(event) =>
          router.push(
            listingHref(basePath, {
              category: params.category,
              minPrice: params.minPrice,
              maxPrice: params.maxPrice,
              sort: event.target.value as ProductSort,
            }),
          )
        }
        className="rounded-md border px-2 py-1.5 text-sm"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
