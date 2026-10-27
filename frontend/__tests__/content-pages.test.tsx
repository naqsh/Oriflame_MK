import { screen, within } from "@testing-library/react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FOOTER_LINKS, SiteFooter } from "@/components/layout/site-footer";
import { getContactDetails } from "@/lib/content/contact";
import { PUBLIC_PAGES } from "@/lib/seo/crawl";

import { renderServer } from "./render-server";
import { render } from "./test-render";

vi.mock("next/server", () => ({ connection: async () => {} }));

type PageModule = { default: () => ReactNode; metadata: Metadata };

const PAGES: Record<string, () => Promise<PageModule>> = {
  "/about": () => import("@/app/about/page"),
  "/contact": () => import("@/app/contact/page"),
  "/privacy": () => import("@/app/privacy/page"),
  "/terms": () => import("@/app/terms/page"),
  "/cookies": () => import("@/app/cookies/page"),
};

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://store.example.pk");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("content pages", () => {
  it.each(Object.keys(PAGES))("%s has exactly one h1, a date and the review notice", async (path) => {
    const page = await PAGES[path]!();
    await renderServer(page.default());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(screen.getByText(/awaiting review by the store owner/)).toBeInTheDocument();
  });

  it("each has a unique title, description and self canonical", async () => {
    const metas = await Promise.all(
      Object.entries(PAGES).map(async ([path, load]) => ({ path, meta: (await load()).metadata })),
    );
    const titles = metas.map(({ meta }) => JSON.stringify(meta.title));
    const descriptions = metas.map(({ meta }) => meta.description);
    expect(new Set(titles).size).toBe(metas.length);
    expect(new Set(descriptions).size).toBe(metas.length);
    for (const { path, meta } of metas) {
      expect(meta.alternates?.canonical).toBe(`https://store.example.pk${path}`);
    }
  });

  it("are all listed in the sitemap and linked from the footer", () => {
    render(<SiteFooter />);
    const footer = within(screen.getByRole("navigation", { name: "Footer" }));
    for (const path of Object.keys(PAGES)) {
      expect(PUBLIC_PAGES).toContain(path);
      expect(FOOTER_LINKS.map((link) => link.href)).toContain(path);
    }
    expect(footer.getAllByRole("link")).toHaveLength(FOOTER_LINKS.length);
  });

  it("never claims cookies are set or that payment details are collected", async () => {
    for (const path of ["/privacy", "/cookies"]) {
      const { unmount } = await renderServer((await PAGES[path]!()).default());
      expect(document.body.textContent).toMatch(/does not set any cookies|no cookies/i);
      unmount();
    }
  });
});

describe("contact details", () => {
  it("shows a placeholder when nothing is configured", async () => {
    vi.stubEnv("CONTACT_EMAIL", "");
    vi.stubEnv("CONTACT_WHATSAPP", "");
    await renderServer((await PAGES["/contact"]!()).default());

    expect(screen.getByText(/will be published here by the store owner/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("renders configured email and WhatsApp links", async () => {
    vi.stubEnv("CONTACT_EMAIL", "owner@example.pk");
    vi.stubEnv("CONTACT_WHATSAPP", "+923001234567");
    await renderServer((await PAGES["/contact"]!()).default());

    expect(screen.getByRole("link", { name: "owner@example.pk" })).toHaveAttribute(
      "href",
      "mailto:owner@example.pk",
    );
    const whatsapp = screen.getByRole("link", { name: "+923001234567" });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/923001234567");
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("drops malformed values instead of rendering them", () => {
    vi.stubEnv("CONTACT_EMAIL", "not-an-email");
    vi.stubEnv("CONTACT_WHATSAPP", "12-34");
    expect(getContactDetails()).toEqual({ email: null, whatsapp: null });

    vi.stubEnv("CONTACT_EMAIL", "a@b.pk<script>");
    expect(getContactDetails().email).toBeNull();
  });
});
