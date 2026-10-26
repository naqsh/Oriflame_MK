/**
 * Which product images may be shown (ADR-001).
 *
 * No Oriflame image host is authorised, so AUTHORISED_IMAGE_HOSTS is empty and
 * next.config.ts builds `images.remotePatterns` from it. Development fixtures point at
 * placeholders this app serves itself under /dev-fixture/; those are rendered from the
 * local path. Anything else gets the "no image" placeholder.
 */

export const AUTHORISED_IMAGE_HOSTS: readonly string[] = [];

/** Local placeholder assets shipped in frontend/public/dev-fixture/. */
const LOCAL_FIXTURE_PREFIX = "/dev-fixture/";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** A `src` the page may render, or null when the image must not be shown. */
export function authorisedImageSrc(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (LOCAL_HOSTS.has(parsed.hostname) && parsed.pathname.startsWith(LOCAL_FIXTURE_PREFIX)) {
    if (parsed.search || parsed.pathname.includes("..")) return null;
    return parsed.pathname;
  }
  if (parsed.protocol === "https:" && AUTHORISED_IMAGE_HOSTS.includes(parsed.hostname)) {
    return parsed.toString();
  }
  return null;
}
