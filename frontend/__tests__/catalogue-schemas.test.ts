import { describe, expect, it } from "vitest";

import {
  categoryDetailSchema,
  categoryTreeSchema,
  productDetailSchema,
  productPageSchema,
  productSummarySchema,
} from "@/lib/api/schemas/catalogue";

import { productDetailPayload, productSummary } from "./catalogue-fixtures";

describe("catalogue schemas", () => {
  it("accepts valid product, page and detail payloads", () => {
    expect(productSummarySchema.safeParse(productSummary()).success).toBe(true);
    expect(
      productPageSchema.safeParse({ items: [productSummary()], total: 1, page: 1, page_size: 24 })
        .success,
    ).toBe(true);
    expect(productDetailSchema.safeParse(productDetailPayload()).success).toBe(true);
  });

  it("accepts a null price, a null image and verified availability", () => {
    const parsed = productSummarySchema.parse(
      productSummary({
        price_pkr: null,
        primary_image: null,
        availability: {
          status: "verified_in_stock",
          label: "In stock at Oriflame when last checked",
          checked_at: "2026-10-27T07:00:00+00:00",
        },
      }),
    );
    expect(parsed.price_pkr).toBeNull();
  });

  it("strips unknown fields", () => {
    const parsed = productSummarySchema.parse({ ...productSummary(), stock_quantity: 42 });
    expect(parsed).not.toHaveProperty("stock_quantity");
  });

  it.each([
    ["price as a number", { price_pkr: 1499 }],
    ["malformed price", { price_pkr: "1,499" }],
    ["negative price", { price_pkr: "-5.00" }],
    ["other currency", { currency: "USD" }],
    ["slug with capitals", { slug: "Sample-Product" }],
    ["empty name", { name: "" }],
    ["unknown availability status", { availability: { status: "in_stock_now", label: "x", checked_at: null } }],
    ["checked_at without timezone", { availability: { status: "not_confirmed", label: "x", checked_at: "2026-10-27T07:00:00" } }],
    ["javascript image URL", { primary_image: { url: "javascript:alert(1)", alt_text: "x" } }],
    ["missing data_source", { data_source: undefined }],
  ])("rejects a product with %s", (_, override) => {
    expect(productSummarySchema.safeParse({ ...productSummary(), ...override }).success).toBe(false);
  });

  it("rejects malformed pages", () => {
    expect(productPageSchema.safeParse({ items: [], total: -1, page: 1, page_size: 24 }).success).toBe(false);
    expect(productPageSchema.safeParse({ items: [], total: 0, page: 0, page_size: 24 }).success).toBe(false);
    expect(productPageSchema.safeParse({ items: "none", total: 0, page: 1, page_size: 24 }).success).toBe(false);
  });

  it("validates nested category trees at every level", () => {
    const tree = {
      items: [
        {
          slug: "face",
          name: "Face",
          product_count: 3,
          children: [{ slug: "face-cream", name: "Face Cream", product_count: 2, children: [] }],
        },
      ],
    };
    expect(categoryTreeSchema.parse(tree).items[0]?.children[0]?.slug).toBe("face-cream");

    const broken = structuredClone(tree);
    (broken.items[0]!.children[0] as { product_count: unknown }).product_count = "two";
    expect(categoryTreeSchema.safeParse(broken).success).toBe(false);
  });

  it("validates category detail with ancestors", () => {
    const detail = {
      slug: "night-cream",
      name: "Night Cream",
      product_count: 1,
      ancestors: [{ slug: "face", name: "Face" }],
      children: [],
    };
    expect(categoryDetailSchema.safeParse(detail).success).toBe(true);
    expect(categoryDetailSchema.safeParse({ ...detail, ancestors: [{ slug: "Face" }] }).success).toBe(false);
  });
});
