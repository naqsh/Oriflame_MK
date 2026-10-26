import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHECKOUT_NOTE,
  PRODUCT_UNAVAILABLE,
  ProductDetailContent,
} from "@/components/catalogue/product-detail";

import { jsonResponse, productDetailPayload, productSummary } from "./catalogue-fixtures";
import { renderServer } from "./render-server";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));

const params = (slug = "sample-product-01") => Promise.resolve({ slug });

function stubProduct(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body, status));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function realProduct(overrides: Record<string, unknown> = {}) {
  return {
    ...productDetailPayload(),
    data_source: "permitted_feed",
    is_development_data: false,
    source_url: "https://pk.oriflame.com/products/product?code=1",
    images: [],
    primary_image: null,
    related: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProductDetailContent", () => {
  it("renders every available field", async () => {
    stubProduct(productDetailPayload());

    const { container } = await renderServer(ProductDetailContent({ params: params() }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sample Product 01");
    expect(screen.getByText("Product code: DEV-0001")).toBeInTheDocument();
    expect(screen.getAllByText(/Rs.1,499/)[0]).toHaveClass("text-2xl");
    expect(screen.getByText("Check availability at Oriflame")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Description" })).toHaveTextContent(
      "Placeholder description.",
    );
    const related = screen.getByRole("region", { name: "Related products" });
    expect(within(related).getByRole("link", { name: "Sample Product 02" })).toBeInTheDocument();
    expect(screen.getByText(CHECKOUT_NOTE)).toBeInTheDocument();
    expect(screen.getByText(/last updated from the source on/)).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Sample Category A" })).toHaveAttribute(
      "href",
      "/categories/sample-category-a",
    );
    // Reserved slots for OR-E4 (referral handoff) and OR-027 (shopping list).
    expect(container.querySelector('[data-slot="referral-handoff"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="add-to-list"]')).not.toBeNull();
  });

  it("flags development data and offers no official source link", async () => {
    stubProduct(productDetailPayload());

    await renderServer(ProductDetailContent({ params: params() }));

    expect(screen.getByRole("complementary", { name: "Development data notice" })).toBeInTheDocument();
    expect(screen.getByText(/there is no official product page/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View this product on/ })).not.toBeInTheDocument();
  });

  it("links the official source in a new tab with rel=noopener", async () => {
    stubProduct(realProduct());

    await renderServer(ProductDetailContent({ params: params() }));

    const link = screen.getByRole("link", { name: /View this product on pk\.oriflame\.com/ });
    expect(link).toHaveAttribute("href", "https://pk.oriflame.com/products/product?code=1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link).toHaveTextContent("(opens in a new tab)");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("omits sections that have no sourced data, with no empty headings", async () => {
    stubProduct(realProduct({ description: null, sku: null, categories: [] }));

    await renderServer(ProductDetailContent({ params: params() }));

    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByText(/Product code/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "All products" })).toHaveAttribute("href", "/products");
  });

  it("shows a neutral placeholder when there are no images", async () => {
    stubProduct(realProduct());

    const { container } = await renderServer(ProductDetailContent({ params: params() }));

    expect(screen.getByRole("img", { name: "No image available for Sample Product 01" })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows every authorised image as a gallery", async () => {
    const image = (n: number) => ({
      url: `http://localhost:3000/dev-fixture/${n}.svg`,
      alt_text: `Placeholder image ${n}`,
    });
    stubProduct({ ...productDetailPayload(), images: [image(1), image(2), image(3)] });

    await renderServer(ProductDetailContent({ params: params() }));

    expect(screen.getAllByRole("img", { name: /Placeholder image \d/ })).toHaveLength(3);
  });

  it("never renders HTML from the source description", async () => {
    stubProduct(
      realProduct({
        description: '<p>Soft <b>glow</b>.</p><script>alert(1)</script><img src=x onerror="alert(2)"><p>A &amp; B</p>',
      }),
    );

    const { container } = await renderServer(ProductDetailContent({ params: params() }));

    const description = screen.getByRole("region", { name: "Description" });
    expect(within(description).getAllByText(/./, { selector: "p" }).map((p) => p.textContent)).toEqual([
      "Soft glow.",
      "A & B",
    ]);
    expect(container.querySelector("script, b, [onerror]")).toBeNull();
  });

  it("adds no claims beyond the sourced text", async () => {
    stubProduct(realProduct({ description: "A light cream." }));

    const { container } = await renderServer(ProductDetailContent({ params: params() }));

    expect(container.textContent).not.toMatch(
      /clinically|dermatologist|proven|cures?|heals?|anti-aging|guarantee/i,
    );
  });

  it.each([
    ["hidden or unknown", "sample-product-01", 404],
    ["malformed", "Bad_Slug", 200],
  ])("calls notFound for a %s slug", async (_, slug, status) => {
    const fetchMock = stubProduct({ detail: "Product not found" }, status);

    await expect(ProductDetailContent({ params: params(slug) })).rejects.toBe(NOT_FOUND);
    if (slug === "Bad_Slug") expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a notice when the backend is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("ECONNREFUSED")));

    await renderServer(ProductDetailContent({ params: params() }));

    expect(screen.getByRole("status")).toHaveTextContent(PRODUCT_UNAVAILABLE);
    expect(console.error).toHaveBeenCalledWith("product_page_failed kind=network status=-");
  });

  it("keeps the related grid to sourced related products", async () => {
    stubProduct(
      realProduct({
        related: [productSummary({ slug: "sample-product-09", name: "Sample Product 09" })],
      }),
    );

    await renderServer(ProductDetailContent({ params: params() }));

    const related = screen.getByRole("region", { name: "Related products" });
    expect(within(related).getAllByRole("listitem")).toHaveLength(1);
  });
});
