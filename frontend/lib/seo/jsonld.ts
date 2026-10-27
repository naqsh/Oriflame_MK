import type { Crumb } from "@/components/layout/breadcrumbs";
import type { ProductDetail } from "@/lib/api/schemas/catalogue";
import type { FaqItem } from "@/lib/content/faq";
import { authorisedImageSrc } from "@/lib/images";
import { canonicalUrl, describe } from "@/lib/seo/metadata";
import { SITE_DISCLAIMER, SITE_NAME, getSiteUrl } from "@/lib/seo/site";

/**
 * Truthful structured data (OR-039). Rules:
 * - Product only for real catalogue data; development fixtures emit nothing.
 * - Offer only when the price is known AND availability is verified (OR-021); today no
 *   source verifies availability, so no Offer is emitted.
 * - No aggregateRating or review, ever.
 * - FAQPage only on a page whose visible content is that list of questions and answers.
 * - Organization is this independent store, never Oriflame; Oriflame appears only as the
 *   factual product brand.
 */

type JsonLd = Record<string, unknown>;

const CONTEXT = "https://schema.org";
// Valid in JSON but treated as line breaks by older JavaScript parsers.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

const AVAILABILITY = {
  verified_in_stock: "https://schema.org/InStock",
  verified_out_of_stock: "https://schema.org/OutOfStock",
} as const;

export function breadcrumbJsonLd(items: Crumb[]): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.href),
    })),
  };
}

export function offerJsonLd(product: ProductDetail): JsonLd | null {
  const status = product.availability.status;
  if (product.price_pkr === null || status === "not_confirmed") return null;
  return {
    "@type": "Offer",
    price: product.price_pkr,
    priceCurrency: "PKR",
    availability: AVAILABILITY[status],
    url: canonicalUrl(`/products/${product.slug}`),
  };
}

export function productJsonLd(product: ProductDetail): JsonLd | null {
  if (product.is_development_data) return null;
  const images = product.images
    .map((image) => authorisedImageSrc(image.url))
    .filter((src): src is string => src !== null)
    .map((src) => new URL(src, getSiteUrl()).toString());
  const offer = offerJsonLd(product);
  return {
    "@context": CONTEXT,
    "@type": "Product",
    name: product.name,
    url: canonicalUrl(`/products/${product.slug}`),
    brand: { "@type": "Brand", name: "Oriflame" },
    ...(product.description ? { description: describe(product.description, product.name) } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.categories[0] ? { category: product.categories[0].name } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(offer ? { offers: offer } : {}),
  };
}

export function websiteJsonLd(): JsonLd {
  const site = getSiteUrl();
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: SITE_NAME,
    url: site,
    potentialAction: {
      "@type": "SearchAction",
      target: `${site}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    name: SITE_NAME,
    url: getSiteUrl(),
    description: SITE_DISCLAIMER,
  };
}

/** FAQPage for questions shown, word for word, on the same page. */
export function faqPageJsonLd(items: readonly FaqItem[], path: string): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    url: canonicalUrl(path),
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * JSON for a <script type="application/ld+json">. "<", ">", "&" and the line separators
 * are escaped, so text such as "</script>" in a product name cannot end the script.
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");
}
