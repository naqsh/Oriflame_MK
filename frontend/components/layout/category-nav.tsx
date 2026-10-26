import Link from "next/link";
import { connection } from "next/server";

import { getCategories } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import type { CategoryNode } from "@/lib/api/schemas/catalogue";

/**
 * Top-level categories with at least one visible product. Rendered per request inside
 * a Suspense boundary; if the backend is unavailable the navigation is left out.
 */
export async function CategoryNav() {
  await connection();
  let categories: CategoryNode[];
  try {
    categories = (await getCategories()).items.filter((category) => category.product_count > 0);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`category_nav_failed kind=${error.kind} status=${error.status ?? "-"}`);
    return null;
  }
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categories">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link href={`/categories/${category.slug}`} className="hover:underline">
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
