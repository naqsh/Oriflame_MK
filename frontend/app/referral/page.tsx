import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { JsonLd } from "@/components/layout/json-ld";
import { BuyFromOriflame } from "@/components/referral/buy-from-oriflame";
import { CurrentReferralSteps, ReferralSteps } from "@/components/referral/referral-steps";
import { REFERRAL_FAQ } from "@/lib/content/faq";
import { GUIDES } from "@/lib/content/guides";
import { faqPageJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_DISCLAIMER } from "@/lib/seo/site";

export const metadata: Metadata = buildMetadata({
  title: "How buying works",
  description:
    "How to buy the products you find here: you continue on Oriflame's official Pakistan website, where checkout, payment and delivery happen.",
  path: "/referral",
});

export default function ReferralPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <JsonLd data={faqPageJsonLd(REFERRAL_FAQ, "/referral")} />
      <section className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold">How buying works</h1>
        <p className="text-muted-foreground">
          You find and shortlist products here. You buy them on Oriflame&apos;s official
          Pakistan website.
        </p>
        <Suspense fallback={<ReferralSteps method={null} />}>
          <CurrentReferralSteps />
        </Suspense>
        <BuyFromOriflame origin="referral_page" />
      </section>

      <section aria-labelledby="faq" className="space-y-4">
        <h2 id="faq" className="font-heading text-2xl font-semibold">
          Questions
        </h2>
        {REFERRAL_FAQ.map((item) => (
          <div key={item.question} className="space-y-1">
            <h3 className="font-medium">{item.question}</h3>
            <p className="text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="guides" className="space-y-3">
        <h2 id="guides" className="font-heading text-2xl font-semibold">
          Guides
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link href={`/guides/${guide.slug}`} className="underline">
                {guide.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted-foreground">{SITE_DISCLAIMER}</p>
    </div>
  );
}
