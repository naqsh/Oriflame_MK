import { Suspense } from "react";

import { HomeCatalogue, HomeCatalogueFallback } from "@/components/home/home-catalogue";
import { HowItWorks } from "@/components/home/how-it-works";

/** Static hero and how-it-works; the catalogue streams in per request (OR-023). */
export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
          Find Oriflame Pakistan products, then buy on Oriflame
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          An independent storefront for browsing and shortlisting Oriflame Pakistan products.
          When you are ready, you complete your purchase on Oriflame&apos;s official website.
        </p>
      </section>
      <Suspense fallback={<HomeCatalogueFallback />}>
        <HomeCatalogue />
      </Suspense>
      <HowItWorks />
    </div>
  );
}
