import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { CATALOGUE_UNAVAILABLE, HomeCatalogue } from "@/components/home/home-catalogue";

import { jsonResponse, productSummary } from "./catalogue-fixtures";
import { render } from "./test-render";

// connection() needs a real request scope; outside Next it only marks the render dynamic.
vi.mock("next/server", () => ({ connection: async () => {} }));

const TREE = {
  items: [
    { slug: "sample-category-a", name: "Sample Category A", product_count: 12, children: [] },
    { slug: "sample-category-b", name: "Sample Category B", product_count: 1, children: [] },
    { slug: "empty-category", name: "Empty Category", product_count: 0, children: [] },
  ],
};

function page(items: unknown[]) {
  return { items, total: items.length, page: 1, page_size: 8 };
}

/** Routes stubbed fetch calls by path and the `featured` / `sort` parameters. */
function stubBackend({
  featured = [] as unknown[],
  latest = [] as unknown[],
  tree = TREE as unknown,
} = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/categories") return jsonResponse(tree);
    if (url.searchParams.get("featured") === "true") return jsonResponse(page(featured));
    if (url.searchParams.get("sort") === "newest") return jsonResponse(page(latest));
    throw new Error(`unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("has exactly one h1 with independent-storefront wording", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/An independent storefront/)).toBeInTheDocument();
    expect(screen.getByText(/official website/i)).toBeInTheDocument();
  });

  it("explains how buying works and links to the referral page", () => {
    render(<HomePage />);

    const section = screen.getByRole("region", { name: "How it works" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).getByText(/handled by Oriflame, not by this site/)).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: "More about buying through Oriflame" }),
    ).toHaveAttribute("href", "/referral");
  });

  it("never claims to be official or authorised", () => {
    const { container } = render(<HomePage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/official (Oriflame )?(store|partner|seller|distributor)/i);
    expect(text).not.toMatch(/authori[sz]ed (by|reseller|seller)/i);
  });
});

describe("HomeCatalogue", () => {
  it("shows featured products and category entry points", async () => {
    const fetchMock = stubBackend({ featured: [productSummary()] });

    render(await HomeCatalogue());

    const products = screen.getByRole("region", { name: "Featured products" });
    expect(within(products).getByRole("link", { name: "Sample Product 01" })).toBeInTheDocument();
    const categories = screen.getByRole("region", { name: "Shop by category" });
    expect(within(categories).getByRole("link", { name: /Sample Category A/ })).toHaveAttribute(
      "href",
      "/categories/sample-category-a",
    );
    expect(within(categories).getByText("12 products")).toBeInTheDocument();
    expect(within(categories).getByText("1 product")).toBeInTheDocument();
    expect(within(categories).queryByText("Empty Category")).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Development data notice" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2); // no "latest" request needed
  });

  it("falls back to the latest products when none are featured", async () => {
    stubBackend({ latest: [productSummary({ name: "Sample Product 12", slug: "sample-product-12" })] });

    render(await HomeCatalogue());

    const products = screen.getByRole("region", { name: "Latest products" });
    expect(within(products).getByRole("link", { name: "Sample Product 12" })).toBeInTheDocument();
  });

  it("omits the dev banner for real data", async () => {
    stubBackend({ featured: [productSummary({ data_source: "feed", is_development_data: false })] });

    render(await HomeCatalogue());

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("shows a helpful empty state for an empty catalogue", async () => {
    stubBackend({ tree: { items: [] } });

    render(await HomeCatalogue());

    expect(screen.getByRole("status")).toHaveTextContent("No products are listed yet");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("omits the category section when no category has products", async () => {
    stubBackend({ featured: [productSummary()], tree: { items: [TREE.items[2]] } });

    render(await HomeCatalogue());

    expect(screen.queryByRole("region", { name: "Shop by category" })).not.toBeInTheDocument();
  });

  it("shows the unavailable notice when the backend is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("connect ECONNREFUSED")));

    render(await HomeCatalogue());

    expect(screen.getByRole("status")).toHaveTextContent(CATALOGUE_UNAVAILABLE);
    expect(screen.getByRole("status")).not.toHaveTextContent(/ECONNREFUSED|TypeError/);
    expect(console.error).toHaveBeenCalledWith("home_catalogue_failed kind=network status=-");
  });
});
