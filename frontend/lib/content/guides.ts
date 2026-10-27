/**
 * Buying guides (OR-041), stored as typed content. A guide is published only once the
 * store owner approves it: set `approval` to the reviewer and date. Unapproved guides
 * still render (so the owner can review them) but are noindex and left out of the
 * sitemap and the guides index.
 */
export interface GuideSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD) of the last content change. */
  updated: string;
  approval: { approvedBy: string; approvedOn: string } | null;
  sections: readonly GuideSection[];
}

export const GUIDES: readonly Guide[] = [
  {
    slug: "how-to-order-oriflame-products-in-pakistan",
    title: "How to order Oriflame products in Pakistan through this store",
    description:
      "Step by step: shortlist products here, continue to Oriflame's official Pakistan website, and place your order there.",
    updated: "2026-10-27",
    approval: null,
    sections: [
      {
        heading: "1. Find the products you want",
        paragraphs: [
          "Browse by category or search by name. Each product page shows the details we have, the indicative price in PKR where available, and a link to the product on Oriflame.",
        ],
      },
      {
        heading: "2. Add them to your list",
        paragraphs: [
          "Use \"Add to list\" and choose quantities. The list is saved in your browser only, so it is still there when you come back on the same device.",
        ],
      },
      {
        heading: "3. Continue to Oriflame",
        paragraphs: [
          "Open your list and select \"Buy from Oriflame\". The next screen shows what to do on Oriflame, including a consultant code to enter if the store uses one, and your list so you can find each product there.",
        ],
      },
      {
        heading: "4. Order on Oriflame",
        paragraphs: [
          "Add the products to your basket on Oriflame's website and complete checkout there. Oriflame handles payment and delivery and confirms the final price and whether each product can be ordered.",
        ],
      },
    ],
  },
  {
    slug: "prices-and-availability",
    title: "Understanding prices and availability on this store",
    description:
      "Why prices here are indicative, what \"Availability not confirmed\" means, and where to check the final price before you order.",
    updated: "2026-10-27",
    approval: null,
    sections: [
      {
        heading: "Prices are indicative",
        paragraphs: [
          "Prices are shown in Pakistani rupees (PKR) where we have them, along with when the product information was last updated. Oriflame can change prices at any time.",
          "The price on Oriflame's website when you order is the one that applies. If a product has no price here, check it on Oriflame.",
        ],
      },
      {
        heading: "Availability is checked on Oriflame",
        paragraphs: [
          "This store does not check stock, so products show \"Availability not confirmed\". Oriflame shows whether a product can be ordered when you add it to your basket there.",
        ],
      },
      {
        heading: "When a product changes",
        paragraphs: [
          "If a product in your list is no longer listed or its price has changed, your list tells you when you open it, so you can decide before continuing to Oriflame.",
        ],
      },
    ],
  },
];

export function isPublished(guide: Guide): boolean {
  return guide.approval !== null;
}

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

/** Paths of owner-approved guides, for the sitemap. */
export function publishedGuidePaths(guides: readonly Guide[] = GUIDES): string[] {
  const published = guides.filter(isPublished);
  return published.length === 0
    ? []
    : ["/guides", ...published.map((guide) => `/guides/${guide.slug}`)];
}
