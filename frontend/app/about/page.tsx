import type { Metadata } from "next";
import Link from "next/link";

import { ContentPage } from "@/components/content/content-page";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildMetadata({
  title: "About this store",
  description:
    "An independent storefront for browsing Oriflame Pakistan products, run by an independent Oriflame consultant. Not the official Oriflame website.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <ContentPage title="About this store">
      <p>
        {SITE_NAME} is an independent storefront run by an independent Oriflame consultant
        in Pakistan. It helps you browse and shortlist Oriflame Pakistan products in one
        place.
      </p>
      <h2>Independent, not official</h2>
      <p>
        This is not the official Oriflame website, and it is not affiliated with or endorsed
        by Oriflame. Product names and brands belong to their owners.
      </p>
      <h2>How buying works</h2>
      <p>
        You do not buy anything on this site. When you are ready, you continue to
        Oriflame&apos;s official Pakistan website, where checkout, payment and delivery
        happen. Where the store owner has set it up, the link or code you are given lets
        Oriflame know you came through this store. <Link href="/referral" className="underline">See how buying works</Link>.
      </p>
      <h2>About the product information</h2>
      <p>
        Prices are shown in Pakistani rupees (PKR) where available and are indicative: the
        price on Oriflame&apos;s website is the one that applies. Stock is never confirmed
        here, so availability is always checked on Oriflame.
      </p>
    </ContentPage>
  );
}
