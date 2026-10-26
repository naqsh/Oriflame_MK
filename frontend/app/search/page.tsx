import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchResults } from "@/components/catalogue/search-results";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

// Search result pages are never indexed (finalised with the other SEO rules in OR-E5).
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <SearchResults searchParams={searchParams} />
    </Suspense>
  );
}
