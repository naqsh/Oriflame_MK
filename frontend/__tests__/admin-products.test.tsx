import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateProductFlagAction } from "@/app/admin/products/actions";
import { ProductFlagButton } from "@/components/admin/product-flag-button";
import { ProductsTable, storefrontStatus } from "@/components/admin/products-table";
import { ADMIN_COOKIE, CATALOGUE_CACHE_TAG } from "@/lib/admin/constants";
import { queryParam } from "@/lib/admin/format";
import type { AdminProduct, AdminProductsPage } from "@/lib/admin/schemas";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));
class Redirect extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
const revalidatePath = vi.fn();
const updateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
  updateTag: (tag: string) => updateTag(tag),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  jar.clear();
  fetchMock.mockReset();
  revalidatePath.mockReset();
  updateTag.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function product(overrides: Partial<AdminProduct> = {}): AdminProduct {
  const base: AdminProduct = {
    slug: "sample-product-01",
    name: "Sample Product 01",
    sku: "DEV-0001",
    source: "dev_fixture",
    price_pkr: "1499.00",
    last_synced_at: "2026-10-26T09:00:00Z",
    is_visible: true,
    is_featured: false,
    listed_by_source: true,
    on_storefront: true,
  };
  const merged = { ...base, ...overrides };
  return { ...merged, on_storefront: merged.is_visible && merged.listed_by_source };
}

function page(items: AdminProduct[], overrides: Partial<AdminProductsPage> = {}): AdminProductsPage {
  return { items, total: items.length, page: 1, page_size: 25, ...overrides };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("storefrontStatus", () => {
  it.each([
    [{}, "Shown"],
    [{ is_featured: true }, "Featured"],
    [{ is_visible: false }, "Hidden by you"],
    [{ listed_by_source: false }, "Not listed by the source"],
  ])("%o → %s", (overrides, label) => {
    expect(storefrontStatus(product(overrides))).toBe(label);
  });
});

describe("queryParam", () => {
  it("trims, takes the first value and caps the length", () => {
    expect(queryParam("  rose ")).toBe("rose");
    expect(queryParam(["a", "b"])).toBe("a");
    expect(queryParam(undefined)).toBe("");
    expect(queryParam("x".repeat(150))).toHaveLength(100);
  });
});

describe("ProductsTable", () => {
  it("lists products with their status and named toggles", () => {
    render(
      <ProductsTable
        data={page([
          product(),
          product({ slug: "sample-product-02", name: "Sample Product 02", is_visible: false }),
          product({ slug: "sample-product-03", name: "Sample Product 03", listed_by_source: false }),
        ])}
        q=""
      />,
    );

    const table = screen.getByRole("table", { name: "Products, by name" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);

    const [shown, hidden, unlisted] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(shown).getByRole("link", { name: "Sample Product 01" })).toHaveAttribute(
      "href",
      "/products/sample-product-01",
    );
    expect(within(shown).getByRole("button", { name: "Hide: Sample Product 01" })).toBeInTheDocument();
    expect(within(shown).getByRole("button", { name: "Feature: Sample Product 01" })).toBeInTheDocument();

    expect(within(hidden).getByText("Hidden by you")).toBeInTheDocument();
    expect(within(hidden).queryByRole("link")).toBeNull();
    expect(within(hidden).getByRole("button", { name: "Show: Sample Product 02" })).toBeInTheDocument();
    // A hidden product cannot be featured, so the toggle is not offered.
    expect(within(hidden).queryByRole("button", { name: /^Feature/ })).toBeNull();

    expect(within(unlisted).getByText("Not listed by the source")).toBeInTheDocument();
    expect(within(unlisted).queryByRole("button", { name: /^Feature/ })).toBeNull();
  });

  it("paginates and keeps the search in the links", () => {
    render(<ProductsTable data={page([product()], { total: 60, page: 2 })} q="rose" />);
    const nav = screen.getByRole("navigation", { name: "Product pages" });
    expect(within(nav).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/products?q=rose",
    );
    expect(within(nav).getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/products?q=rose&page=3",
    );
    expect(nav).toHaveTextContent("Page 2 of 3 (60 products)");
  });

  it("explains an empty table", () => {
    const { rerender } = render(<ProductsTable data={page([])} q="" />);
    expect(screen.getByText(/Run a catalogue sync first/)).toBeInTheDocument();
    rerender(<ProductsTable data={page([])} q="rose" />);
    expect(screen.getByText("No products match “rose”.")).toBeInTheDocument();
  });
});

describe("ProductFlagButton", () => {
  it("submits the toggle and announces the result", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, message: "Sample Product 01: Hidden." });
    render(
      <ProductFlagButton
        action={action}
        slug="sample-product-01"
        productName="Sample Product 01"
        field="is_visible"
        value={false}
        label="Hide"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Hide: Sample Product 01" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Sample Product 01: Hidden.");
    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(Object.fromEntries(sent)).toEqual({
      slug: "sample-product-01",
      field: "is_visible",
      value: "false",
    });
  });
});

describe("updateProductFlagAction", () => {
  const updated = { product: product({ is_visible: false }), message: "Hidden from the storefront." };

  it("patches only the chosen flag, then expires the catalogue cache", async () => {
    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockResolvedValue(json(updated));

    const state = await updateProductFlagAction(
      null,
      form({ slug: "sample-product-01", field: "is_visible", value: "false" }),
    );

    expect(state).toEqual({ ok: true, message: "Sample Product 01: Hidden from the storefront." });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/v1/admin/products/sample-product-01");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ is_visible: false });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok");
    expect(updateTag).toHaveBeenCalledWith(CATALOGUE_CACHE_TAG);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/products");
  });

  it.each([
    [{ slug: "Not A Slug", field: "is_visible", value: "false" }],
    [{ slug: "sample-product-01", field: "name", value: "false" }],
    [{ slug: "sample-product-01", field: "is_visible", value: "yes" }],
  ])("refuses a tampered form without calling the API: %o", async (fields) => {
    jar.set(ADMIN_COOKIE, "tok");
    const state = await updateProductFlagAction(null, form(fields));
    expect(state.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a refusal through and leaves the cache alone", async () => {
    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockResolvedValue(json({ detail: "Show the product before featuring it." }, 409));

    const state = await updateProductFlagAction(
      null,
      form({ slug: "sample-product-01", field: "is_featured", value: "true" }),
    );

    expect(state).toEqual({ ok: false, message: "Show the product before featuring it." });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it.each([
    [404, { detail: "Product not found" }, "That product no longer exists."],
    [500, { detail: "boom" }, "The change could not be saved."],
    [200, { unexpected: true }, "The change could not be saved."],
  ])("reports HTTP %i plainly", async (status, body, message) => {
    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockResolvedValue(json(body, status));
    const state = await updateProductFlagAction(
      null,
      form({ slug: "sample-product-01", field: "is_visible", value: "false" }),
    );
    expect(state).toEqual({ ok: false, message });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("reports an unreachable API", async () => {
    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const state = await updateProductFlagAction(
      null,
      form({ slug: "sample-product-01", field: "is_visible", value: "false" }),
    );
    expect(state.message).toMatch(/could not be reached/);
  });

  it("redirects without a session or on an expired one", async () => {
    const fields = { slug: "sample-product-01", field: "is_visible", value: "false" };
    await expect(updateProductFlagAction(null, form(fields))).rejects.toThrow("reason=signin");

    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockResolvedValue(json({ detail: "expired" }, 401));
    await expect(updateProductFlagAction(null, form(fields))).rejects.toThrow("reason=expired");
  });
});
