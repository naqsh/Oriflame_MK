import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GuidePage, { generateMetadata, generateStaticParams } from "@/app/guides/[slug]/page";
import GuidesPage, { metadata as guidesMetadata } from "@/app/guides/page";
import { REFERRAL_FAQ } from "@/lib/content/faq";
import { GUIDES, type Guide, getGuide, publishedGuidePaths } from "@/lib/content/guides";
import { faqPageJsonLd } from "@/lib/seo/jsonld";

import { renderServer } from "./render-server";
import { render } from "./test-render";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const params = (slug: string) => Promise.resolve({ slug });
const props = (slug: string) => ({ params: params(slug), searchParams: Promise.resolve({}) });

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://store.example.pk");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Unconfirmed promises and claims the content must never make (OR-041 edge cases).
const FORBIDDEN =
  /guarantee|discount|% off|free delivery|within \d+ (days|hours)|best price|cheapest|testimonial|clinically|dermatologist|cures?|heals?|official partner|#1/i;

function allText(guide: Guide): string {
  return [guide.title, guide.description, ...guide.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(" ");
}

describe("FAQ", () => {
  it("covers ordering, payment and delivery, the code, prices and availability", () => {
    const questions = REFERRAL_FAQ.map((item) => item.question).join(" ");
    expect(questions).toMatch(/order/i);
    expect(questions).toMatch(/pay/i);
    expect(questions).toMatch(/consultant code/i);
    expect(questions).toMatch(/prices/i);
    expect(questions).toMatch(/Availability not confirmed/);
    expect(new Set(REFERRAL_FAQ.map((item) => item.question)).size).toBe(REFERRAL_FAQ.length);
  });

  it("FAQPage JSON-LD mirrors the visible questions and answers exactly", () => {
    const data = faqPageJsonLd(REFERRAL_FAQ, "/referral?utm_source=x");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.url).toBe("https://store.example.pk/referral");
    expect(data.mainEntity).toEqual(
      REFERRAL_FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    );
  });

  it("makes no unconfirmed promises", () => {
    for (const item of REFERRAL_FAQ) expect(`${item.question} ${item.answer}`).not.toMatch(FORBIDDEN);
  });
});

describe("guides", () => {
  it("has 2–4 guides with unique slugs, titles and descriptions", () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(2);
    expect(GUIDES.length).toBeLessThanOrEqual(4);
    for (const key of ["slug", "title", "description"] as const) {
      expect(new Set(GUIDES.map((guide) => guide[key])).size).toBe(GUIDES.length);
    }
    expect(generateStaticParams()).toEqual(GUIDES.map((guide) => ({ slug: guide.slug })));
  });

  it("makes no unconfirmed promises or efficacy claims", () => {
    for (const guide of GUIDES) expect(allText(guide)).not.toMatch(FORBIDDEN);
  });

  it.each(GUIDES.map((guide) => guide.slug))("%s renders one h1, sections and its date", async (slug) => {
    await renderServer(GuidePage(props(slug)));
    const guide = getGuide(slug)!;

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(guide.title);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(guide.sections.length);
    expect(screen.getByText(/Last updated/).querySelector("time")).toHaveAttribute("dateTime", guide.updated);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("unapproved guides are noindex, show the review notice and stay out of the sitemap", async () => {
    const guide = GUIDES[0]!;
    expect(guide.approval).toBeNull();

    const meta = await generateMetadata(props(guide.slug));
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe(`https://store.example.pk/guides/${guide.slug}`);
    expect(publishedGuidePaths()).toEqual([]);
    expect(guidesMetadata.robots).toEqual({ index: false, follow: true });

    await renderServer(GuidePage(props(guide.slug)));
    expect(screen.getByText(/awaiting review by the store owner/)).toBeInTheDocument();
  });

  it("approved guides are indexable and listed in the sitemap with the index page", async () => {
    const approved: Guide = { ...GUIDES[0]!, approval: { approvedBy: "Owner", approvedOn: "2026-11-01" } };
    expect(publishedGuidePaths([approved, GUIDES[1]!])).toEqual(["/guides", `/guides/${approved.slug}`]);
  });

  it("unknown slugs are not found", async () => {
    await expect(renderServer(GuidePage(props("nope")))).rejects.toThrow("NEXT_NOT_FOUND");
    const meta = await generateMetadata(props("nope"));
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("the index lists every guide with one h1", () => {
    render(<GuidesPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const guide of GUIDES) {
      expect(screen.getByRole("link", { name: guide.title })).toHaveAttribute("href", `/guides/${guide.slug}`);
    }
  });
});
