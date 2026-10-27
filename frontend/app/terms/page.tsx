import type { Metadata } from "next";

import { ContentPage } from "@/components/content/content-page";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of use",
  description:
    "Terms for using this independent storefront: information only, indicative prices, and all purchases made on Oriflame's official website under Oriflame's terms.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <ContentPage title="Terms of use">
      <p>By using {SITE_NAME} you agree to these terms.</p>
      <h2>What this site is</h2>
      <p>
        An independent storefront for browsing Oriflame Pakistan products. It is not the
        official Oriflame website and is not affiliated with or endorsed by Oriflame.
      </p>
      <h2>No sales on this site</h2>
      <p>
        Nothing is sold here. Purchases are made on Oriflame&apos;s official website, where
        Oriflame&apos;s own terms, prices, payment and delivery conditions apply.
      </p>
      <h2>Product information</h2>
      <p>
        We aim to show accurate product information. Prices are indicative and shown in PKR
        where available; availability is not confirmed here. The details on Oriflame&apos;s
        website take precedence.
      </p>
      <h2>Using the site</h2>
      <ul>
        <li>Use the site lawfully and do not try to disrupt it or access parts that are not public.</li>
        <li>These terms may change; the date above shows the latest version.</li>
      </ul>
    </ContentPage>
  );
}
