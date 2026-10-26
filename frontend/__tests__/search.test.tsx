import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SEARCH_BUSY,
  SEARCH_UNAVAILABLE,
  SearchResults,
} from "@/components/catalogue/search-results";
import type { RawSearchParams } from "@/lib/listing";
import { parseSearchParams, searchHref } from "@/lib/search";

import { jsonResponse, productSummary } from "./catalogue-fixtures";
import { renderServer } from "./render-server";

const TREE = {
  items: [
    { slug: "small", name: "Small", product_count: 1, children: [] },
    { slug: "big", name: "Big", product_count: 9, children: [] },
    { slug: "empty", name: "Empty", product_count: 0, children: [] },
    { slug: "mid", name: "Mid", product_count: 4, children: [] },
    { slug: "tiny", name: "Tiny", product_count: 1, children: [] },
    { slug: "large", name: "Large", product_count: 7, children: [] },
  ],
};

let requests: URL[] = [];

function stubBackend(search: Response | Error, categories: Response | Error = jsonResponse(TREE)) {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url);
      const result = url.pathname === "/api/v1/search" ? search : categories;
      if (result instanceof Error) throw result;
      return result.clone();
    }),
  );
}

const results = (items: unknown[], total = items.length) =>
  jsonResponse({ items, total, page: 1, page_size: 24 });

function run(raw: RawSearchParams) {
  return renderServer(SearchResults({ searchParams: Promise.resolve(raw) }));
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseSearchParams / searchHref", () => {
  it("trims, keeps the first value and normalises the page", () => {
    expect(parseSearchParams({ q: ["  cream  ", "x"], page: "-1" })).toEqual({ q: "cream", page: 1 });
    expect(parseSearchParams({})).toEqual({ q: "", page: 1 });
    expect(parseSearchParams({ q: "a", page: "3" })).toEqual({ q: "a", page: 3 });
  });

  it("cuts queries to 100 characters", () => {
    expect(parseSearchParams({ q: "x".repeat(150) }).q).toHaveLength(100);
  });

  it("builds encoded URLs", () => {
    expect(searchHref({ q: "rose & oud", page: 1 })).toBe("/search?q=rose+%26+oud");
    expect(searchHref({ q: "کریم", page: 2 })).toBe("/search?q=%DA%A9%D8%B1%DB%8C%D9%85&page=2");
  });
});

describe("SearchResults", () => {
  it("reflects the query in the heading and the input, and renders results", async () => {
    stubBackend(results([productSummary()], 30));

    await run({ q: "sample" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search results for “sample”");
    expect(screen.getByRole("searchbox", { name: "Search products" })).toHaveValue("sample");
    expect(screen.getByRole("status")).toHaveTextContent("30 results");
    expect(screen.getByRole("link", { name: "Sample Product 01" })).toBeInTheDocument();
    const next = within(screen.getByRole("navigation", { name: "Pagination" })).getByRole("link", {
      name: "Next page",
    });
    expect(next).toHaveAttribute("href", "/search?q=sample&page=2");
  });

  it.each([{}, { q: "" }, { q: "    " }])(
    "shows a prompt without calling the API for %j",
    async (raw) => {
      stubBackend(results([]));

      await run(raw);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search products");
      expect(screen.getByText(/Enter a product name/)).toBeInTheDocument();
      expect(requests).toHaveLength(0);
    },
  );

  it("works as a plain GET form (no JavaScript needed)", async () => {
    stubBackend(results([]));

    await run({});

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(within(form).getByRole("searchbox")).toHaveAttribute("name", "q");
    expect(within(form).getByRole("searchbox")).toHaveAttribute("maxLength", "100");
  });

  it("sends at most 100 characters to the API", async () => {
    stubBackend(results([]));

    await run({ q: `${"a".repeat(120)}` });

    const sent = requests.find((url) => url.pathname === "/api/v1/search");
    expect(sent?.searchParams.get("q")).toHaveLength(100);
  });

  it("echoes special characters as text, never as markup", async () => {
    stubBackend(results([]));
    const attack = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;

    const { container } = await run({ q: attack });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(attack);
    expect(screen.getByRole("searchbox")).toHaveValue(attack.slice(0, 100));
    expect(container.querySelector("img, script, [onerror]")).toBeNull();
  });

  it("suggests the most popular categories when nothing matches", async () => {
    stubBackend(results([]));

    await run({ q: "zzqxv" });

    expect(screen.getByRole("status")).toHaveTextContent("0 results");
    expect(screen.getByText(/No products matched your search/)).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Popular categories" });
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Big",
      "Large",
      "Mid",
      "Small",
    ]);
    expect(screen.getByRole("link", { name: "Browse all products" })).toHaveAttribute("href", "/products");
  });

  it("still shows the no-results message when categories fail", async () => {
    stubBackend(results([]), new TypeError("down"));

    await run({ q: "zzqxv" });

    expect(screen.getByText(/No products matched your search/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Popular categories" })).not.toBeInTheDocument();
  });

  it("offers the first page when the page is beyond the last", async () => {
    stubBackend(results([], 3));

    await run({ q: "cream", page: "9" });

    expect(screen.getByRole("link", { name: "Go to the first page" })).toHaveAttribute(
      "href",
      "/search?q=cream",
    );
  });

  it.each([
    [429, SEARCH_BUSY],
    [500, SEARCH_UNAVAILABLE],
  ])("shows a friendly message for HTTP %i", async (status, message) => {
    stubBackend(jsonResponse({ detail: "x" }, status));

    await run({ q: "cream" });

    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("searchbox")).toHaveValue("cream");
    expect(console.error).toHaveBeenCalledWith(`search_failed kind=http status=${status}`);
  });

  it("shows the unavailable message when the backend cannot be reached", async () => {
    stubBackend(new TypeError("ECONNREFUSED"));

    await run({ q: "cream" });

    expect(screen.getByRole("status")).toHaveTextContent(SEARCH_UNAVAILABLE);
  });
});

describe("search page metadata", () => {
  it("is never indexed", async () => {
    const { metadata } = await import("@/app/search/page");
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
