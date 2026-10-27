import { afterEach, beforeEach, describe as group, expect, it, vi } from "vitest";

import { categoryMetadata, productMetadata } from "@/lib/seo/catalogue-metadata";
import { DESCRIPTION_LENGTH, buildMetadata, canonicalUrl, describe } from "@/lib/seo/metadata";
import { getSiteUrl, isIndexable } from "@/lib/seo/site";

import { jsonResponse, productDetailPayload } from "./catalogue-fixtures";

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://store.example.pk/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

group("getSiteUrl / isIndexable", () => {
  it("returns the configured origin without a trailing slash or path", () => {
    vi.stubEnv("SITE_URL", "https://store.example.pk/ignored/path?x=1");
    expect(getSiteUrl()).toBe("https://store.example.pk");
  });

  it("defaults to localhost outside production", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("fails a production build without SITE_URL", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSiteUrl()).toThrow(/SITE_URL is not set/);
  });

  it.each(["not a url", "ftp://store.example.pk", "javascript:alert(1)"])(
    "rejects %s",
    (value) => {
      vi.stubEnv("SITE_URL", value);
      expect(() => getSiteUrl()).toThrow(/absolute http\(s\) URL/);
    },
  );

  it("is indexable only in production", () => {
    vi.stubEnv("APP_ENV", "production");
    expect(isIndexable()).toBe(true);
    vi.stubEnv("APP_ENV", "test");
    expect(isIndexable()).toBe(false);
  });
});

group("canonicalUrl", () => {
  it.each([
    ["/products", "https://store.example.pk/products"],
    ["/products?category=face&sort=price_asc&page=3", "https://store.example.pk/products"],
    ["/products/x?utm_source=fb&utm_medium=cpc#reviews", "https://store.example.pk/products/x"],
    ["/", "https://store.example.pk/"],
  ])("canonicalises %s to an absolute URL with no query or fragment", (path, expected) => {
    expect(canonicalUrl(path)).toBe(expected);
  });
});

group("describe", () => {
  it("uses the fallback for empty text", () => {
    expect(describe(null, "Fallback text.")).toBe("Fallback text.");
    expect(describe("   ", "Fallback text.")).toBe("Fallback text.");
  });

  it("turns source HTML into plain text", () => {
    expect(describe("<p>A <b>light</b> cream.</p>", "x")).toBe("A light cream.");
  });

  it("cuts long text at a word boundary with an ellipsis", () => {
    const text = "word ".repeat(80);
    const result = describe(text, "x");
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_LENGTH);
    expect(result.endsWith("word…")).toBe(true);
  });
});

group("buildMetadata", () => {
  it("builds title, description, canonical, Open Graph and Twitter fields", () => {
    const metadata = buildMetadata({
      title: "Sample",
      description: "A description.",
      path: "/products/sample?sort=new",
      image: "/dev-fixture/a.svg",
    });
    expect(metadata).toMatchObject({
      title: "Sample",
      description: "A description.",
      alternates: { canonical: "https://store.example.pk/products/sample" },
      openGraph: {
        type: "website",
        locale: "en_PK",
        url: "https://store.example.pk/products/sample",
        images: [{ url: "https://store.example.pk/dev-fixture/a.svg" }],
      },
      twitter: { card: "summary_large_image", images: ["https://store.example.pk/dev-fixture/a.svg"] },
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("marks noindex pages and uses a summary card without an image", () => {
    const metadata = buildMetadata({ title: "Search", description: "d", path: "/search", noindex: true });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.twitter).toMatchObject({ card: "summary" });
  });
});

group("catalogue metadata", () => {
  function stub(body: unknown, status = 200) {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, status)));
  }

  it("gives each product its own title and canonical, and noindexes fixture data", async () => {
    stub(productDetailPayload());
    const fixture = await productMetadata("sample-product-01");
    expect(fixture.title).toBe("Sample Product 01");
    expect(fixture.alternates?.canonical).toBe("https://store.example.pk/products/sample-product-01");
    expect(fixture.robots).toEqual({ index: false, follow: true });

    stub({ ...productDetailPayload(), slug: "real-product", name: "Real Product", is_development_data: false, data_source: "feed", images: [] });
    const real = await productMetadata("real-product");
    expect(real.title).toBe("Real Product");
    expect(real.robots).toBeUndefined();
    expect(real.title).not.toBe(fixture.title);
  });

  it("builds a specific fallback description from name and category", async () => {
    stub({ ...productDetailPayload(), description: null });
    const metadata = await productMetadata("sample-product-01");
    expect(metadata.description).toBe(
      "Sample Product 01 in Sample Category A: product details on this independent store. Buy it on Oriflame's official Pakistan website.",
    );
  });

  it("describes categories with their product count", async () => {
    stub({ slug: "face", name: "Face", product_count: 1, ancestors: [], children: [] });
    const metadata = await categoryMetadata("face");
    expect(metadata.title).toBe("Face");
    expect(metadata.description).toMatch(/^Browse 1 Face product from Oriflame Pakistan/);
    expect(metadata.alternates?.canonical).toBe("https://store.example.pk/categories/face");
  });

  it("noindexes unknown pages and degrades when the API is down", async () => {
    stub({ detail: "Product not found" }, 404);
    expect(await productMetadata("missing")).toMatchObject({ robots: { index: false } });
    stub({ detail: "Category not found" }, 404);
    expect(await categoryMetadata("missing")).toMatchObject({ robots: { index: false } });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect((await productMetadata("sample-product-01")).title).toBe("Product");
    expect((await categoryMetadata("face")).title).toBe("Category");
  });
});
