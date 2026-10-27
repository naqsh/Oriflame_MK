import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductDetailContent } from "@/components/catalogue/product-detail";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { productMetadata } from "@/lib/seo/catalogue-metadata";

/** Rendered per request (no generateStaticParams yet: the build has no backend; OR-052). */
export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  return productMetadata((await params).slug);
}

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={2} />}>
      <ProductDetailContent params={params} />
    </Suspense>
  );
}
