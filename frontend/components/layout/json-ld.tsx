import { serializeJsonLd } from "@/lib/seo/jsonld";

/** Structured data script. The content is escaped JSON, never raw source text. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Escaped by serializeJsonLd: "<" cannot appear, so the script cannot be closed early.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
