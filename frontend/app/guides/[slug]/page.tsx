import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/layout/json-ld";
import { GUIDES, getGuide, isPublished } from "@/lib/content/guides";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

const DATE = new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeZone: "Asia/Karachi" });

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return { title: "Guide not found", robots: { index: false, follow: true } };
  return buildMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}`,
    // Unapproved guides render for owner review but are never indexed.
    noindex: !isPublished(guide),
  });
}

async function GuideContent({ params }: { params: PageProps<"/guides/[slug]">["params"] }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "How buying works", href: "/referral" },
    { name: guide.title, href: `/guides/${guide.slug}` },
  ];
  return (
    <article className="max-w-3xl space-y-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold">{guide.title}</h1>
        <p className="text-muted-foreground">{guide.description}</p>
        <p className="text-sm text-muted-foreground">
          Last updated{" "}
          <time dateTime={guide.updated}>{DATE.format(new Date(`${guide.updated}T12:00:00Z`))}</time>
        </p>
        {isPublished(guide) ? null : (
          <p className="rounded-md border border-amber-600 px-3 py-2 text-sm">
            This guide is awaiting review by the store owner and may change.
          </p>
        )}
      </header>
      {guide.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="font-heading text-xl font-semibold">{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

export default function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading guide…</p>}>
      <GuideContent params={params} />
    </Suspense>
  );
}
