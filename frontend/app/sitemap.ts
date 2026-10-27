import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { sitemapEntries } from "@/lib/seo/crawl";

/** Built per request (the build has no backend); an API failure fails the request. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return sitemapEntries();
}
