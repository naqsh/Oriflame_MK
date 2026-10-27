/** Site-wide identity used by the layout and metadata. */

export const SITE_NAME = "Oriflame Pakistan Referral Store";

export const SITE_DESCRIPTION =
  "Independent storefront for browsing Oriflame Pakistan products. Checkout, payment and delivery happen on Oriflame's official website.";

export const SITE_DISCLAIMER =
  "This is an independent referral storefront, not the official Oriflame website. It is not affiliated with or endorsed by Oriflame. Checkout, payment and delivery happen on Oriflame's official platform.";

const DEV_SITE_URL = "http://localhost:3000";

/**
 * The public origin used for canonical URLs, Open Graph, the sitemap and robots.txt.
 * `SITE_URL` is a server-side setting (not secret). Required in production builds, so
 * a missing value fails `next build` instead of publishing localhost canonicals.
 */
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SITE_URL is not set. Set it to the store's public origin before building.");
    }
    return DEV_SITE_URL;
  }
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("SITE_URL must be an absolute http(s) URL, e.g. https://example.pk");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("SITE_URL must be an absolute http(s) URL, e.g. https://example.pk");
  }
  return url.origin;
}

/**
 * Whether search engines may index this deployment. Only production deployments are
 * indexable; development, test and staging (and anything showing fixture data) are not.
 */
export function isIndexable(): boolean {
  return process.env.APP_ENV === "production";
}
