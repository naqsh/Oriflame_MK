import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductsResults } from "@/components/catalogue/products-results";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { buildMetadata } from "@/lib/seo/metadata";

// Filtered, sorted and paged variants all canonicalise to /products (no query string).
export const metadata: Metadata = buildMetadata({
  title: "All products",
  description:
    "Browse Oriflame Pakistan products listed on this independent store, with prices in PKR where available. Checkout happens on Oriflame's official website.",
  path: "/products",
});

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">All products</h1>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductsResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
