import type { MetadataRoute } from "next";

import { getCategories, getProducts } from "@/lib/api/catalogue";
import type { CategoryNode } from "@/lib/api/schemas/catalogue";
import { getSiteUrl, isIndexable } from "@/lib/seo/site";

/** Never indexed: admin, API, search results and the visitor's own list. */
export const PRIVATE_PATHS = ["/admin", "/api", "/search", "/list"] as const;

/** Fixed public pages, including the informational and legal content pages. */
export const PUBLIC_PAGES: readonly string[] = [
  "/",
  "/products",
  "/referral",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
];

/** One sitemap file holds at most 50,000 URLs; beyond that, split with generateSitemaps. */
export const SITEMAP_URL_LIMIT = 50_000;
const PAGE_SIZE = 100;

/**
 * robots.txt policy. Only production deployments are indexable; everything else
 * (development, test, staging, fixture data) disallows all crawling.
 */
export function robotsRules(indexable: boolean, siteUrl: string): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

function categoriesWithProducts(nodes: CategoryNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.product_count > 0 ? [node.slug] : []),
    ...categoriesWithProducts(node.children),
  ]);
}

/**
 * Every indexable URL. Called at request time (see app/sitemap.ts). If the API fails,
 * this throws so the sitemap request fails loudly instead of publishing an empty file.
 */
export async function sitemapEntries(
  extraPaths: readonly string[] = [],
): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return [];
  const site = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [...PUBLIC_PAGES, ...extraPaths].map((path) => ({
    url: `${site}${path === "/" ? "" : path}`,
  }));

  for (let page = 1; entries.length < SITEMAP_URL_LIMIT; page += 1) {
    const result = await getProducts({ page, pageSize: PAGE_SIZE, sort: "name_asc" });
    for (const product of result.items) {
      // Visible products only (the API never lists hidden ones); fixture data is never listed.
      if (product.is_development_data) continue;
      entries.push({
        url: `${site}/products/${product.slug}`,
        lastModified: product.last_synced_at,
      });
    }
    if (page * PAGE_SIZE >= result.total || result.items.length === 0) break;
  }

  const tree = await getCategories();
  for (const slug of categoriesWithProducts(tree.items)) {
    entries.push({ url: `${site}/categories/${slug}` });
  }
  return entries.slice(0, SITEMAP_URL_LIMIT);
}
