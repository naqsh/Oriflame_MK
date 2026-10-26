import { connection } from "next/server";
import { Suspense } from "react";

import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { getProducts } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import type { ProductSummary } from "@/lib/api/schemas/catalogue";

/**
 * Server Component data fetching under Cache Components (ADR-007).
 * A condensed version of frontend/components/home/home-catalogue.tsx (OR-023).
 *
 * - The page shell (heading, layout) is static; the data part renders per request
 *   inside Suspense, with a fallback that has the same footprint.
 * - Data comes through lib/api (Zod-validated), never a raw fetch.
 * - ApiError becomes a short notice and a value-free log line; anything else is a bug
 *   and is rethrown.
 * - No "use client": this needs no browser interactivity.
 */

async function LatestProducts() {
  await connection(); // per request: the build has no backend (ADR-007)
  // Load inside try, render after it: try/catch cannot catch rendering errors
  // (react-hooks/error-boundaries), so JSX is never returned from the try block.
  let products: ProductSummary[];
  try {
    products = (await getProducts({ sort: "newest", pageSize: 8 })).items;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`latest_products_failed kind=${error.kind} status=${error.status ?? "-"}`);
    return (
      <p role="status" className="text-muted-foreground">
        Products are temporarily unavailable. Please try again shortly.
      </p>
    );
  }
  return <ProductGrid products={products} emptyMessage="No products are listed yet." />;
}

export default function ExamplePage() {
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-semibold">Latest products</h1>
      <Suspense fallback={<ProductGridSkeleton />}>
        <LatestProducts />
      </Suspense>
    </section>
  );
}
