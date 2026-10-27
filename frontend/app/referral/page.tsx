import type { Metadata } from "next";
import { Suspense } from "react";

import { BuyFromOriflame } from "@/components/referral/buy-from-oriflame";
import { CurrentReferralSteps, ReferralSteps } from "@/components/referral/referral-steps";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE_DISCLAIMER } from "@/lib/seo/site";

export const metadata: Metadata = buildMetadata({
  title: "How buying works",
  description:
    "How to buy the products you find here: you continue on Oriflame's official Pakistan website, where checkout, payment and delivery happen.",
  path: "/referral",
});

const FAQ = [
  {
    question: "Is this the official Oriflame website?",
    answer:
      "No. This is an independent storefront for browsing Oriflame Pakistan products. Orders are placed on Oriflame's official website.",
  },
  {
    question: "Where do I pay, and who delivers my order?",
    answer:
      "Checkout, payment and delivery all happen on Oriflame's official website. This site never asks for your address or payment details.",
  },
  {
    question: "Will my shopping list be sent to Oriflame?",
    answer:
      "No. Your list stays in your browser. When you continue to Oriflame we show the items so you can add them there.",
  },
] as const;

export default function ReferralPage() {
  return (
    <div className="max-w-3xl space-y-10">
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
        {FAQ.map((item) => (
          <div key={item.question} className="space-y-1">
            <h3 className="font-medium">{item.question}</h3>
            <p className="text-muted-foreground">{item.answer}</p>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">More answers will be added here.</p>
      </section>

      <p className="text-sm text-muted-foreground">{SITE_DISCLAIMER}</p>
    </div>
  );
}
