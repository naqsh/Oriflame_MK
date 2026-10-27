import { cacheLife } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CATALOGUE_CACHE,
  getCategories,
  getCategory,
  getProduct,
  getProducts,
  searchProducts,
} from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";

import { jsonResponse, productDetailPayload, productSummary } from "./catalogue-fixtures";

const PAGE = { items: [productSummary()], total: 1, page: 1, page_size: 24 };

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(String(fetchMock.mock.calls[0]?.[0]));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(cacheLife).mockClear();
});

describe("catalogue API functions", () => {
  it("getProducts maps parameters to the backend's query names", async () => {
    const fetchMock = stubFetch(jsonResponse(PAGE));

    const page = await getProducts({
      category: "face",
      minPrice: "100",
      maxPrice: "2000",
      sort: "price_asc",
      page: 2,
      pageSize: 12,
    });

    expect(page.total).toBe(1);
    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/products");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      category: "face",
      min_price: "100",
      max_price: "2000",
      sort: "price_asc",
      page: "2",
      page_size: "12",
    });
  });

  it("getProducts sends featured as true or false", async () => {
    const fetchMock = stubFetch(jsonResponse(PAGE));
    await getProducts({ featured: true });
    expect(requestedUrl(fetchMock).searchParams.get("featured")).toBe("true");

    const again = stubFetch(jsonResponse(PAGE));
    await getProducts({ featured: false });
    expect(requestedUrl(again).searchParams.get("featured")).toBe("false");
  });

  it("getProducts sends no query string when there are no parameters", async () => {
    const fetchMock = stubFetch(jsonResponse(PAGE));
    await getProducts({ category: "", minPrice: undefined });
    expect(requestedUrl(fetchMock).search).toBe("");
  });

  it("getProduct returns the parsed detail", async () => {
    const fetchMock = stubFetch(jsonResponse(productDetailPayload()));
    const product = await getProduct("sample-product-01");
    expect(product?.sku).toBe("DEV-0001");
    expect(requestedUrl(fetchMock).pathname).toBe("/api/v1/products/sample-product-01");
  });

  it("getProduct returns null on 404", async () => {
    stubFetch(jsonResponse({ detail: "Product not found" }, 404));
    await expect(getProduct("missing-product")).resolves.toBeNull();
  });

  it.each(["Bad_Slug", "../admin", "a b", ""])(
    "getProduct returns null for the malformed slug %j without calling the backend",
    async (slug) => {
      const fetchMock = stubFetch(jsonResponse(productDetailPayload()));
      await expect(getProduct(slug)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("getProduct rethrows other failures", async () => {
    stubFetch(jsonResponse({ detail: "Internal server error" }, 500));
    await expect(getProduct("sample-product-01")).rejects.toMatchObject({
      kind: "http",
      status: 500,
    });
  });

  it("getProduct rejects a malformed payload", async () => {
    stubFetch(jsonResponse({ ...productDetailPayload(), price_pkr: 1499 }));
    await expect(getProduct("sample-product-01")).rejects.toBeInstanceOf(ApiError);
  });

  it("getCategories and getCategory call the category endpoints", async () => {
    const treeFetch = stubFetch(jsonResponse({ items: [] }));
    await expect(getCategories()).resolves.toEqual({ items: [] });
    expect(requestedUrl(treeFetch).pathname).toBe("/api/v1/categories");

    const detail = { slug: "face", name: "Face", product_count: 0, ancestors: [], children: [] };
    const detailFetch = stubFetch(jsonResponse(detail));
    await expect(getCategory("face")).resolves.toEqual(detail);
    expect(requestedUrl(detailFetch).pathname).toBe("/api/v1/categories/face");
  });

  it("getCategory returns null on 404 and for malformed slugs", async () => {
    stubFetch(jsonResponse({ detail: "Category not found" }, 404));
    await expect(getCategory("missing")).resolves.toBeNull();
    await expect(getCategory("Not A Slug")).resolves.toBeNull();
  });

  it("searchProducts encodes the query, including Urdu and symbols", async () => {
    const fetchMock = stubFetch(jsonResponse(PAGE));
    await searchProducts({ q: "گلاب & cream", page: 2, pageSize: 10 });
    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/search");
    expect(url.searchParams.get("q")).toBe("گلاب & cream");
    expect(url.searchParams.get("page_size")).toBe("10");
  });
});

describe("catalogue read caching", () => {
  it("caches successful reads for the catalogue lifetime", async () => {
    stubFetch(jsonResponse(PAGE));
    await getProducts();
    expect(cacheLife).toHaveBeenCalledWith(CATALOGUE_CACHE);
  });

  it("caches a 404 like a success: an unknown slug is a stable answer", async () => {
    stubFetch(jsonResponse({ detail: "Product not found" }, 404));
    await expect(getProduct("missing")).resolves.toBeNull();
    expect(cacheLife).toHaveBeenCalledWith(CATALOGUE_CACHE);
  });

  it.each([
    ["a server error", () => stubFetch(jsonResponse({ detail: "boom" }, 503))],
    ["a network failure", () => vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))],
  ])("keeps %s out of the cache and rethrows it as ApiError", async (_label, stub) => {
    stub();
    const error = await getCategories().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    const lifetime = vi.mocked(cacheLife).mock.calls[0]?.[0];
    expect(lifetime).not.toEqual(CATALOGUE_CACHE);
    expect(lifetime).toMatchObject({ stale: 0 });
  });

  it("keeps the HTTP status on a rethrown failure", async () => {
    stubFetch(jsonResponse({ detail: "boom" }, 503));
    await expect(getCategories()).rejects.toMatchObject({ kind: "http", status: 503 });
  });

  it("validates after the cache, so a malformed cached body still fails", async () => {
    stubFetch(jsonResponse({ items: "not a list" }));
    await expect(getCategories()).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("does not cache search", async () => {
    stubFetch(jsonResponse(PAGE));
    await searchProducts({ q: "cream" });
    expect(cacheLife).not.toHaveBeenCalled();
  });
});
