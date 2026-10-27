import type { Metadata } from "next";
import Link from "next/link";

import { GUIDES, isPublished } from "@/lib/content/guides";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Buying guides",
  description:
    "Short guides to ordering Oriflame products in Pakistan through this independent store, and to how prices and availability are shown.",
  path: "/guides",
  // Indexed only once at least one guide is owner-approved.
  noindex: !GUIDES.some(isPublished),
});

export default function GuidesPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-3xl font-semibold">Buying guides</h1>
      <ul className="space-y-4">
        {GUIDES.map((guide) => (
          <li key={guide.slug} className="space-y-1">
            <Link href={`/guides/${guide.slug}`} className="font-medium underline">
              {guide.title}
            </Link>
            <p className="text-muted-foreground">{guide.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
