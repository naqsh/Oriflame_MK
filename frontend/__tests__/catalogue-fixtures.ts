import type { ProductSummary } from "@/lib/api/schemas/catalogue";

/** API-shaped test data (not a test file: Vitest only collects *.test.ts[x]). */
export function productSummary(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    slug: "sample-product-01",
    name: "Sample Product 01",
    price_pkr: "1499.00",
    currency: "PKR",
    primary_image: {
      url: "http://localhost:3000/dev-fixture/sample-product.svg",
      alt_text: "Placeholder image for Sample Product 01",
    },
    availability: {
      status: "not_confirmed",
      label: "Availability not confirmed",
      checked_at: null,
    },
    data_source: "dev_fixture",
    is_development_data: true,
    ...overrides,
  };
}

export function productDetailPayload(): Record<string, unknown> {
  return {
    ...productSummary(),
    sku: "DEV-0001",
    description: "Placeholder description.",
    images: [productSummary().primary_image],
    categories: [{ slug: "sample-category-a", name: "Sample Category A" }],
    source_url: "http://localhost:3000/dev-fixture/products/dev-sample-01",
    last_synced_at: "2026-10-26T00:00:00Z",
    related: [productSummary({ slug: "sample-product-02", name: "Sample Product 02" })],
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
