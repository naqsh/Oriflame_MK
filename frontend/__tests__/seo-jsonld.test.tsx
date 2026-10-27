import { render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductDetailContent } from "@/components/catalogue/product-detail";
import { JsonLd } from "@/components/layout/json-ld";
import type { ProductDetail } from "@/lib/api/schemas/catalogue";
import { productDetailSchema } from "@/lib/api/schemas/catalogue";
import {
  breadcrumbJsonLd,
  offerJsonLd,
  organizationJsonLd,
  productJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "@/lib/seo/jsonld";

import { jsonResponse, productDetailPayload } from "./catalogue-fixtures";
import { renderServer } from "./render-server";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

const SITE = "https://store.example.pk";

function product(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return productDetailSchema.parse({
    ...productDetailPayload(),
    data_source: "feed",
    is_development_data: false,
    images: [],
    ...overrides,
  });
}

const verified = (status: "verified_in_stock" | "verified_out_of_stock") => ({
  status,
  label: "x",
  checked_at: "2026-10-27T07:00:00Z",
});

function scripts(container: HTMLElement): unknown[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
    JSON.parse(node.textContent ?? "null"),
  );
}

beforeEach(() => {
  vi.stubEnv("SITE_URL", SITE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("offerJsonLd", () => {
  it("is omitted when availability is not confirmed, even with a price", () => {
    expect(offerJsonLd(product())).toBeNull();
  });

  it("is omitted when the price is unknown, even if availability is verified", () => {
    expect(offerJsonLd(product({ price_pkr: null, availability: verified("verified_in_stock") }))).toBeNull();
  });

  it.each([
    ["verified_in_stock", "https://schema.org/InStock"],
    ["verified_out_of_stock", "https://schema.org/OutOfStock"],
  ] as const)("is present with PKR when price and %s are verified", (status, schemaValue) => {
    expect(offerJsonLd(product({ availability: verified(status) }))).toEqual({
      "@type": "Offer",
      price: "1499.00",
      priceCurrency: "PKR",
      availability: schemaValue,
      url: `${SITE}/products/sample-product-01`,
    });
  });
});

describe("productJsonLd", () => {
  it("describes real products truthfully, with Oriflame only as the brand", () => {
    const data = productJsonLd(product());
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Sample Product 01",
      url: `${SITE}/products/sample-product-01`,
      brand: { "@type": "Brand", name: "Oriflame" },
      description: "Placeholder description.",
      sku: "DEV-0001",
      category: "Sample Category A",
    });
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|review/i);
  });

  it("includes authorised images and the verified offer", () => {
    const data = productJsonLd(
      product({
        images: [
          { url: "http://localhost:3000/dev-fixture/a.svg", alt_text: "a" },
          { url: "https://media-cdn.oriflame.com/x.jpg", alt_text: "not authorised" },
        ],
        availability: verified("verified_in_stock"),
      }),
    );
    expect(data).toMatchObject({ image: [`${SITE}/dev-fixture/a.svg`], offers: { "@type": "Offer" } });
  });

  it("is suppressed for development fixture products", () => {
    expect(productJsonLd(product({ is_development_data: true, data_source: "dev_fixture" }))).toBeNull();
  });
});

describe("site-wide JSON-LD", () => {
  it("describes this independent store, never Oriflame, with a search action", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      url: SITE,
      potentialAction: { target: `${SITE}/search?q={search_term_string}` },
    });
    const organization = organizationJsonLd();
    expect(organization).toMatchObject({ "@type": "Organization", name: "Oriflame Pakistan Referral Store" });
    expect(organization.description).toMatch(/not the official Oriflame website/);
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers items in order with absolute URLs", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Home", href: "/" },
        { name: "Face", href: "/categories/face" },
        { name: "Night Cream", href: "/categories/night-cream" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Face", item: `${SITE}/categories/face` },
        { "@type": "ListItem", position: 3, name: "Night Cream", item: `${SITE}/categories/night-cream` },
      ],
    });
  });
});

describe("serializeJsonLd and JsonLd", () => {
  it("cannot be broken out of by '</script>' in a product name", () => {
    const hostile = `Cream </script><script>alert(1)</script> & co${String.fromCharCode(0x2028)}`;
    const text = serializeJsonLd({ name: hostile });
    expect(text).not.toMatch(/[<>&]/);
    expect(text).not.toContain(String.fromCharCode(0x2028));
    expect(JSON.parse(text)).toEqual({ name: hostile });

    const { container } = render(<JsonLd data={{ name: hostile }} />);
    expect(container.querySelectorAll("script")).toHaveLength(1);
    expect(scripts(container)).toEqual([{ name: hostile }]);
  });
});

describe("product page structured data", () => {
  function stubApi(detail: unknown, category: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path.startsWith("/api/v1/categories/")) {
          return category instanceof Error ? Promise.reject(category) : jsonResponse(category);
        }
        return jsonResponse(detail);
      }),
    );
  }

  const NIGHT = {
    slug: "sample-category-a",
    name: "Sample Category A",
    product_count: 1,
    ancestors: [{ slug: "face", name: "Face" }],
    children: [],
  };

  it("shows every ancestor of the primary category, and emits Product for real data", async () => {
    stubApi({ ...productDetailPayload(), is_development_data: false, data_source: "feed" }, NIGHT);

    const { container } = await renderServer(
      ProductDetailContent({ params: Promise.resolve({ slug: "sample-product-01" }) }),
    );

    const nav = container.querySelector('nav[aria-label="Breadcrumb"]') as HTMLElement;
    expect(within(nav).getAllByRole("listitem").map((li) => li.textContent?.replace("/", "").trim())).toEqual([
      "Home",
      "Face",
      "Sample Category A",
      "Sample Product 01",
    ]);
    const [trail, productData] = scripts(container)[0] as [Record<string, unknown>, Record<string, unknown>];
    expect((trail.itemListElement as unknown[]).length).toBe(4);
    expect(productData["@type"]).toBe("Product");
    expect(productData).not.toHaveProperty("offers"); // availability not confirmed
  });

  it("emits only the breadcrumb for fixture data, and survives a category lookup failure", async () => {
    stubApi(productDetailPayload(), new TypeError("offline"));

    const { container } = await renderServer(
      ProductDetailContent({ params: Promise.resolve({ slug: "sample-product-01" }) }),
    );

    const [only] = scripts(container) as [Record<string, unknown>];
    expect(only["@type"]).toBe("BreadcrumbList");
    expect((only.itemListElement as { name: string }[]).map((item) => item.name)).toEqual([
      "Home",
      "Sample Category A",
      "Sample Product 01",
    ]);
  });
});
