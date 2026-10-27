import type { Metadata } from "next";

import { SITE_NAME, getSiteUrl } from "@/lib/seo/site";
import { toParagraphs } from "@/lib/text";

/** Search engines show roughly this many characters of a description. */
export const DESCRIPTION_LENGTH = 155;

export interface MetadataInput {
  title: string;
  description: string;
  /** Site path such as "/products/x"; any query string or fragment is dropped. */
  path: string;
  /** An absolute or site-relative image URL for link previews. */
  image?: string;
  noindex?: boolean;
}

/**
 * Absolute canonical URL for `path`. Query strings (filters, sort, page, tracking
 * parameters such as utm_*) and fragments are always removed, so every variant of a
 * page points to one canonical URL.
 */
export function canonicalUrl(path: string): string {
  const url = new URL(path, getSiteUrl());
  return `${url.origin}${url.pathname}`;
}

/** Plain text cut at a word boundary to about DESCRIPTION_LENGTH characters. */
export function describe(text: string | null | undefined, fallback: string): string {
  const plain = toParagraphs(text).join(" ").trim() || fallback;
  if (plain.length <= DESCRIPTION_LENGTH) return plain;
  const cut = plain.slice(0, DESCRIPTION_LENGTH - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(" "), DESCRIPTION_LENGTH * 0.6));
  return `${atWord.replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** One builder for every page: title, description, canonical, Open Graph and Twitter. */
export function buildMetadata({ title, description, path, image, noindex }: MetadataInput): Metadata {
  const url = canonicalUrl(path);
  const images = image ? [{ url: new URL(image, getSiteUrl()).toString() }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_PK",
      title,
      description,
      url,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      ...(images ? { images: images.map((entry) => entry.url) } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
