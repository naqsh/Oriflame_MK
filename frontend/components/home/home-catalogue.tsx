import Link from "next/link";
import { connection } from "next/server";

import { DevDataBanner } from "@/components/layout/dev-data-banner";
import { ProductGrid } from "@/components/product/product-grid";
import { getCategories, getProducts } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import type { CategoryNode, ProductSummary } from "@/lib/api/schemas/catalogue";

export const HOME_PRODUCT_COUNT = 8;
export const CATALOGUE_UNAVAILABLE =
  "The catalogue is temporarily unavailable. Please try again shortly.";

interface HomeData {
  heading: string;
  products: ProductSummary[];
  categories: CategoryNode[];
}

/** Featured products, or the newest ones when the owner has featured none. */
async function loadHomeData(): Promise<HomeData> {
  const [featured, tree] = await Promise.all([
    getProducts({ featured: true, pageSize: HOME_PRODUCT_COUNT }),
    getCategories(),
  ]);
  const categories = tree.items.filter((category) => category.product_count > 0);
  if (featured.items.length > 0) {
    return { heading: "Featured products", products: featured.items, categories };
  }
  const latest = await getProducts({ sort: "newest", pageSize: HOME_PRODUCT_COUNT });
  return { heading: "Latest products", products: latest.items, categories };
}

/**
 * The data-driven part of the homepage, rendered per request inside a Suspense
 * boundary (see frontend/AGENT.md, "Homepage rendering"). If the backend fails, the
 * rest of the page still renders with a short notice.
 */
export async function HomeCatalogue() {
  await connection();
  let data: HomeData;
  try {
    data = await loadHomeData();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`home_catalogue_failed kind=${error.kind} status=${error.status ?? "-"}`);
    return (
      <p role="status" className="rounded-md border px-4 py-3 text-muted-foreground">
        {CATALOGUE_UNAVAILABLE}
      </p>
    );
  }

  if (data.products.length === 0) {
    return (
      <p role="status" className="rounded-md border px-4 py-3 text-muted-foreground">
        No products are listed yet. Please check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <DevDataBanner items={data.products} />
      <section aria-labelledby="home-products" className="space-y-4">
        <h2 id="home-products" className="font-heading text-2xl font-semibold">
          {data.heading}
        </h2>
        <ProductGrid products={data.products} />
      </section>
      {data.categories.length > 0 ? (
        <section aria-labelledby="home-categories" className="space-y-4">
          <h2 id="home-categories" className="font-heading text-2xl font-semibold">
            Shop by category
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="flex h-full flex-col rounded-lg border p-4 hover:border-foreground"
                >
                  <span className="font-medium">{category.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {category.product_count}{" "}
                    {category.product_count === 1 ? "product" : "products"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Same footprint as the product grid, so the layout does not jump when data arrives. */
export function HomeCatalogueFallback() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
