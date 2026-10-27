import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { robotsRules } from "@/lib/seo/crawl";
import { getSiteUrl, isIndexable } from "@/lib/seo/site";

/** Per request, so the deployment's runtime APP_ENV decides, not the build's. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsRules(isIndexable(), getSiteUrl());
}
