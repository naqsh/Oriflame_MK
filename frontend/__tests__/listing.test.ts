import { describe, expect, it } from "vitest";

import { categoryOptions } from "@/lib/categories";
import { hasFilters, listingHref, parseListingParams } from "@/lib/listing";

describe("parseListingParams", () => {
  it("returns defaults for an empty query", () => {
    expect(parseListingParams({})).toEqual({ sort: "name_asc", page: 1 });
  });

  it("keeps valid values", () => {
    expect(
      parseListingParams({
        category: "face",
        min_price: "100",
        max_price: "2500.50",
        sort: "price_desc",
        page: "3",
      }),
    ).toEqual({ category: "face", minPrice: "100", maxPrice: "2500.50", sort: "price_desc", page: 3 });
  });

  it.each([
    [{ page: "-2" }, { page: 1 }],
    [{ page: "0" }, { page: 1 }],
    [{ page: "1.5" }, { page: 1 }],
    [{ page: "abc" }, { page: 1 }],
    [{ page: "999999" }, { page: 10_000 }],
    [{ sort: "popularity" }, { sort: "name_asc" }],
    [{ sort: ["price_asc", "newest"] }, { sort: "price_asc" }],
  ])("normalises %j", (raw, expected) => {
    expect(parseListingParams(raw)).toMatchObject(expected);
  });

  it.each([
    { category: "Bad_Slug" },
    { category: "../admin" },
    { min_price: "-5" },
    { min_price: "1,000" },
    { max_price: "1e9" },
    { max_price: "   " },
  ])("drops invalid filter %j", (raw) => {
    const parsed = parseListingParams(raw);
    expect(parsed.category).toBeUndefined();
    expect(parsed.minPrice).toBeUndefined();
    expect(parsed.maxPrice).toBeUndefined();
  });

  it("swaps a min price above the max and explains it", () => {
    const parsed = parseListingParams({ min_price: "5000", max_price: "100" });
    expect(parsed).toMatchObject({ minPrice: "100", maxPrice: "5000" });
    expect(parsed.notice).toMatch(/swapped/);
  });
});

describe("listingHref", () => {
  it("leaves defaults out of the URL", () => {
    expect(listingHref("/products", { sort: "name_asc", page: 1 })).toBe("/products");
  });

  it("writes the backend's parameter names", () => {
    expect(
      listingHref("/products", {
        category: "face",
        minPrice: "100",
        maxPrice: "200",
        sort: "newest",
        page: 2,
      }),
    ).toBe("/products?category=face&min_price=100&max_price=200&sort=newest&page=2");
  });

  it("round-trips through parseListingParams", () => {
    const params = { category: "face", minPrice: "1", maxPrice: "9", sort: "price_asc", page: 4 } as const;
    const href = listingHref("/products", params);
    const query = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseListingParams(query)).toEqual(params);
  });
});

describe("hasFilters", () => {
  it("ignores sort and page", () => {
    expect(hasFilters({ sort: "newest", page: 3 })).toBe(false);
    expect(hasFilters({ sort: "name_asc", page: 1, maxPrice: "10" })).toBe(true);
  });
});

describe("categoryOptions", () => {
  it("flattens the tree depth-first with indentation", () => {
    const tree = [
      {
        slug: "face",
        name: "Face",
        product_count: 2,
        children: [{ slug: "eyes", name: "Eyes", product_count: 1, children: [] }],
      },
      { slug: "body", name: "Body", product_count: 0, children: [] },
    ];
    expect(categoryOptions(tree)).toEqual([
      { slug: "face", label: "Face" },
      { slug: "eyes", label: "— Eyes" },
      { slug: "body", label: "Body" },
    ]);
  });
});
