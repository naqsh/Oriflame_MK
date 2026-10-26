import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CATEGORY_UNAVAILABLE, CategoryContent } from "@/components/catalogue/category-content";
import { ProductsResults } from "@/components/catalogue/products-results";
import { LISTING_UNAVAILABLE, ProductListing } from "@/components/filters/product-listing";

import { jsonResponse, productSummary } from "./catalogue-fixtures";
import { renderServer } from "./render-server";
import { render } from "./test-render";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw NOT_FOUND;
  },
}));

const TREE = {
  items: [
    {
      slug: "face",
      name: "Face",
      product_count: 3,
      children: [{ slug: "eyes", name: "Eyes", product_count: 1, children: [] }],
    },
  ],
};

const EYES = {
  slug: "eyes",
  name: "Eyes",
  product_count: 1,
  ancestors: [{ slug: "face", name: "Face" }],
  children: [
    { slug: "eye-liner", name: "Eye Liner", product_count: 1 },
    { slug: "eye-empty", name: "Eye Empty", product_count: 0 },
  ],
};

function page(items: unknown[], total = items.length) {
  return { items, total, page: 1, page_size: 24 };
}

let requests: URL[] = [];

function stubBackend(routes: Record<string, Response | (() => Response)>) {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url);
      const route = routes[url.pathname];
      if (!route) throw new TypeError(`no route for ${url.pathname}`);
      return typeof route === "function" ? route() : route.clone();
    }),
  );
}

const productsRequest = () => requests.find((url) => url.pathname === "/api/v1/products");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProductListing", () => {
  it("announces the result count and lists products", async () => {
    stubBackend({ "/api/v1/products": jsonResponse(page([productSummary()], 30)) });

    render(await ProductListing({ basePath: "/products", params: { sort: "name_asc", page: 1 } }));

    expect(screen.getByRole("status")).toHaveTextContent("30 products");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("link", { name: "Sample Product 01" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Development data notice" })).toBeInTheDocument();
  });

  it("sends the URL state to the backend", async () => {
    stubBackend({ "/api/v1/products": jsonResponse(page([productSummary()])) });

    await ProductListing({
      basePath: "/products",
      params: { category: "face", minPrice: "1", maxPrice: "9", sort: "price_asc", page: 2 },
    });

    expect(Object.fromEntries(productsRequest()!.searchParams)).toEqual({
      category: "face",
      min_price: "1",
      max_price: "9",
      sort: "price_asc",
      page: "2",
      page_size: "24",
    });
  });

  it("shows a helpful empty state with a link to clear filters", async () => {
    stubBackend({ "/api/v1/products": jsonResponse(page([])) });

    render(
      await ProductListing({
        basePath: "/products",
        params: { category: "face", maxPrice: "5", sort: "newest", page: 1 },
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("0 products");
    expect(screen.getByText("No products match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/products?sort=newest",
    );
  });

  it("offers the first page when the page is beyond the last", async () => {
    stubBackend({ "/api/v1/products": jsonResponse(page([], 5)) });

    render(await ProductListing({ basePath: "/products", params: { sort: "name_asc", page: 7 } }));

    expect(screen.getByText("This page has no products.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the first page" })).toHaveAttribute("href", "/products");
  });

  it("shows the price correction notice", async () => {
    stubBackend({ "/api/v1/products": jsonResponse(page([productSummary()])) });

    render(
      await ProductListing({
        basePath: "/products",
        params: { minPrice: "1", maxPrice: "9", sort: "name_asc", page: 1, notice: "Swapped." },
      }),
    );

    expect(screen.getByText("Swapped.")).toBeInTheDocument();
  });

  it("shows a notice instead of crashing when the backend is down", async () => {
    stubBackend({});

    render(await ProductListing({ basePath: "/products", params: { sort: "name_asc", page: 1 } }));

    expect(screen.getByRole("status")).toHaveTextContent(LISTING_UNAVAILABLE);
    expect(console.error).toHaveBeenCalledWith("product_listing_failed kind=network status=-");
  });
});

describe("ProductsResults", () => {
  it("normalises bad URL values and offers every category as a filter", async () => {
    stubBackend({
      "/api/v1/products": jsonResponse(page([productSummary()])),
      "/api/v1/categories": jsonResponse(TREE),
    });

    await renderServer(
      ProductsResults({
        searchParams: Promise.resolve({ page: "-3", sort: "bogus", category: "Bad!" }),
      }),
    );

    expect(Object.fromEntries(productsRequest()!.searchParams)).toEqual({
      sort: "name_asc",
      page: "1",
      page_size: "24",
    });
    const select = screen.getByRole("combobox", { name: "Category" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All categories",
      "Face",
      "— Eyes",
    ]);
  });

  it("still lists products when categories cannot be loaded", async () => {
    stubBackend({ "/api/v1/products": jsonResponse(page([productSummary()])) });

    await renderServer(ProductsResults({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sample Product 01" })).toBeInTheDocument();
  });
});

describe("CategoryContent", () => {
  it("shows the breadcrumb, one h1, subcategories with products and the listing", async () => {
    stubBackend({
      "/api/v1/categories/eyes": jsonResponse(EYES),
      "/api/v1/products": jsonResponse(page([productSummary()])),
    });

    await renderServer(
      CategoryContent({
        params: Promise.resolve({ slug: "eyes" }),
        searchParams: Promise.resolve({ category: "face", sort: "newest" }),
      }),
    );

    expect(screen.getByRole("heading", { level: 1, name: "Eyes" })).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Face" })).toHaveAttribute("href", "/categories/face");
    const subs = screen.getByRole("navigation", { name: "Subcategories" });
    expect(within(subs).getAllByRole("link").map((l) => l.textContent)).toEqual(["Eye Liner (1)"]);
    // The path decides the category; ?category=face is ignored.
    expect(productsRequest()!.searchParams.get("category")).toBe("eyes");
    expect(productsRequest()!.searchParams.get("sort")).toBe("newest");
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
  });

  it("calls notFound for an unknown category", async () => {
    stubBackend({ "/api/v1/categories/missing": jsonResponse({ detail: "Category not found" }, 404) });

    await expect(
      CategoryContent({
        params: Promise.resolve({ slug: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("calls notFound for a malformed slug without asking the backend", async () => {
    stubBackend({});

    await expect(
      CategoryContent({
        params: Promise.resolve({ slug: "Not_A_Slug" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(NOT_FOUND);
    expect(requests).toHaveLength(0);
  });

  it("shows a notice when the backend is down", async () => {
    stubBackend({});

    render(
      await CategoryContent({
        params: Promise.resolve({ slug: "eyes" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(CATEGORY_UNAVAILABLE);
  });
});
