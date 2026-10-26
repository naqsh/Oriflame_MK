import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductListing } from "@/components/filters/product-listing";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { getCategory } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import type { CategoryDetail } from "@/lib/api/schemas/catalogue";
import { type RawSearchParams, parseListingParams } from "@/lib/listing";

export const CATEGORY_UNAVAILABLE =
  "This category is temporarily unavailable. Please try again shortly.";

/**
 * Body of /categories/[slug]. Unknown slugs call notFound(). Because this renders inside
 * Suspense after streaming starts, Next.js serves the not-found page with a noindex tag
 * and HTTP 200 (see frontend/AGENT.md, "Not found status").
 */
export async function CategoryContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  let category: CategoryDetail | null;
  try {
    category = await getCategory(slug);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`category_page_failed kind=${error.kind} status=${error.status ?? "-"}`);
    return (
      <p role="status" className="rounded-md border px-4 py-3 text-muted-foreground">
        {CATEGORY_UNAVAILABLE}
      </p>
    );
  }
  if (category === null) notFound();

  const basePath = `/categories/${category.slug}`;
  // The category comes from the path; a ?category= parameter is ignored here.
  const listing = { ...parseListingParams(await searchParams), category: undefined };
  const subcategories = category.children.filter((child) => child.product_count > 0);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            ...category.ancestors.map((a) => ({ name: a.name, href: `/categories/${a.slug}` })),
            { name: category.name, href: basePath },
          ]}
        />
        <h1 className="font-heading text-3xl font-semibold">{category.name}</h1>
      </div>
      {subcategories.length > 0 ? (
        <nav aria-label="Subcategories">
          <ul className="flex flex-wrap gap-2">
            {subcategories.map((child) => (
              <li key={child.slug}>
                <Link
                  href={`/categories/${child.slug}`}
                  className="inline-block rounded-full border px-3 py-1 text-sm hover:border-foreground"
                >
                  {child.name} ({child.product_count})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <ProductListing basePath={basePath} params={listing} fixedCategory={category.slug} />
    </div>
  );
}
