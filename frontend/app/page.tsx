import { SITE_NAME } from "@/lib/seo/site";

export default function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-semibold">{SITE_NAME}</h1>
      <p className="max-w-2xl text-muted-foreground">
        Browse Oriflame Pakistan products here, then complete your purchase on Oriflame&apos;s
        official website. The product catalogue is coming soon.
      </p>
    </section>
  );
}
