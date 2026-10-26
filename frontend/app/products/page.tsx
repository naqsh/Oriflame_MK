import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductsResults } from "@/components/catalogue/products-results";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

export const metadata: Metadata = { title: "All products" };

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
