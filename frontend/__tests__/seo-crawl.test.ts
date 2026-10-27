import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRIVATE_PATHS, robotsRules, sitemapEntries } from "@/lib/seo/crawl";

import { jsonResponse, productSummary } from "./catalogue-fixtures";

const SITE = "https://store.example.pk";

const TREE = {
  items: [
    {
      slug: "face",
      name: "Face",
      product_count: 2,
      children: [{ slug: "eyes", name: "Eyes", product_count: 0, children: [] }],
    },
    { slug: "body", name: "Body", product_count: 1, children: [] },
  ],
};

function real(slug: string, synced = "2026-10-20T10:00:00Z") {
  return productSummary({
    slug,
    name: slug,
    data_source: "feed",
    is_development_data: false,
    last_synced_at: synced,
  });
}

let requested: URL[] = [];

function stubApi(pages: unknown[][], total: number, tree: unknown = TREE) {
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requested.push(url);
      if (url.pathname === "/api/v1/categories") return jsonResponse(tree);
      const page = Number(url.searchParams.get("page") ?? "1");
      const items = pages[page - 1] ?? [];
      return jsonResponse({ items, total, page, page_size: 100 });
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("SITE_URL", SITE);
  vi.stubEnv("APP_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("robotsRules", () => {
  it("allows public pages, blocks private ones and points to the sitemap in production", () => {
    expect(robotsRules(true, SITE)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/search", "/list"] },
      sitemap: `${SITE}/sitemap.xml`,
    });
    expect(PRIVATE_PATHS).toContain("/admin");
  });

  it("disallows everything outside production, with no sitemap", () => {
    expect(robotsRules(false, SITE)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("sitemapEntries", () => {
  it("lists public pages, visible real products with lastModified, and categories with products", async () => {
    stubApi([[real("rose-cream"), productSummary({ slug: "sample-product-01" })]], 2);

    const entries = await sitemapEntries(["/guides/example"]);

    expect(entries).toEqual([
      { url: SITE },
      { url: `${SITE}/products` },
      { url: `${SITE}/referral` },
      { url: `${SITE}/about` },
      { url: `${SITE}/contact` },
      { url: `${SITE}/privacy` },
      { url: `${SITE}/terms` },
      { url: `${SITE}/cookies` },
      { url: `${SITE}/guides/example` },
      { url: `${SITE}/products/rose-cream`, lastModified: "2026-10-20T10:00:00Z" },
      { url: `${SITE}/categories/face` },
      { url: `${SITE}/categories/body` },
    ]);
    const urls = entries.map((entry) => entry.url).join(" ");
    expect(urls).not.toMatch(/sample-product-01|\/search|\/list|\/admin|\/eyes/);
  });

  it("follows every page of products", async () => {
    const first = Array.from({ length: 100 }, (_, n) => real(`p-${n}`));
    stubApi([first, [real("p-100")]], 101);

    const entries = await sitemapEntries();

    expect(entries.filter((entry) => entry.url.includes("/products/"))).toHaveLength(101);
    expect(
      requested.filter((url) => url.pathname === "/api/v1/products").map((url) => url.searchParams.get("page")),
    ).toEqual(["1", "2"]);
  });

  it("is empty outside production and asks the API nothing", async () => {
    vi.stubEnv("APP_ENV", "staging");
    stubApi([[real("rose-cream")]], 1);

    expect(await sitemapEntries()).toEqual([]);
    expect(requested).toHaveLength(0);
  });

  it("fails loudly when the API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(sitemapEntries()).rejects.toMatchObject({ kind: "network" });
  });
});
