import type { Metadata } from "next";
import { Suspense } from "react";

import { CategoryContent } from "@/components/catalogue/category-content";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { categoryMetadata } from "@/lib/seo/catalogue-metadata";

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  return categoryMetadata((await params).slug);
}

export default function CategoryPage({ params, searchParams }: PageProps<"/categories/[slug]">) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CategoryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
