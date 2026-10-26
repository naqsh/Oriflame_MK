import { Suspense } from "react";

import { CategoryContent } from "@/components/catalogue/category-content";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

export default function CategoryPage({ params, searchParams }: PageProps<"/categories/[slug]">) {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CategoryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
