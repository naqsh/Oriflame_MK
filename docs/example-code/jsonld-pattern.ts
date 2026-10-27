/**
 * Pattern: truthful JSON-LD (see frontend/lib/seo/jsonld.ts for the real builders).
 *
 * 1. Builders return plain objects, or null when the data does not justify the type.
 * 2. Gate every claim on verified data: no Offer without a known price AND verified
 *    availability; no Product for development fixtures; never aggregateRating/Review.
 * 3. Mirror what the page visibly shows (FAQPage text, breadcrumb trail).
 * 4. Serialise through one escaping function, rendered by one component.
 */

type JsonLd = Record<string, unknown>;

interface Item {
  slug: string;
  name: string;
  pricePkr: number | null;
  availability: "verified_in_stock" | "verified_out_of_stock" | "not_confirmed";
  isDevelopmentData: boolean;
}

const AVAILABILITY = {
  verified_in_stock: "https://schema.org/InStock",
  verified_out_of_stock: "https://schema.org/OutOfStock",
} as const;

// Gate: return null rather than a partial or guessed Offer.
export function offerJsonLd(item: Item, url: string): JsonLd | null {
  if (item.pricePkr === null || item.availability === "not_confirmed") return null;
  return {
    "@type": "Offer",
    price: item.pricePkr,
    priceCurrency: "PKR",
    availability: AVAILABILITY[item.availability],
    url,
  };
}

export function productJsonLd(item: Item, url: string): JsonLd | null {
  if (item.isDevelopmentData) return null; // fixtures are never presented as real products
  const offer = offerJsonLd(item, url);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    url,
    brand: { "@type": "Brand", name: "Oriflame" }, // factual brand, not the publisher
    ...(offer ? { offers: offer } : {}), // optional fields only when present
  };
}

// "<" etc. are escaped so text like "</script>" in a product name cannot end the tag.
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// Usage in a Server Component (null builders render nothing):
//
//   const data = productJsonLd(item, canonicalUrl(`/products/${item.slug}`));
//   return data ? <JsonLd data={data} /> : null;
