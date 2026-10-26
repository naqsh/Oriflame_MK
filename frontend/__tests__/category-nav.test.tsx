import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryNav } from "@/components/layout/category-nav";

import { jsonResponse } from "./catalogue-fixtures";

// connection() needs a real request scope; outside Next it only marks the render dynamic.
vi.mock("next/server", () => ({ connection: async () => {} }));

const TREE = {
  items: [
    { slug: "accessories", name: "Accessories", product_count: 0, children: [] },
    {
      slug: "face",
      name: "Face",
      product_count: 3,
      children: [{ slug: "face-cream", name: "Face Cream", product_count: 2, children: [] }],
    },
  ],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CategoryNav", () => {
  it("links top-level categories that have products", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(TREE)));

    render((await CategoryNav())!);

    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Face" })).toHaveAttribute("href", "/categories/face");
    expect(screen.queryByRole("link", { name: "Accessories" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Face Cream" })).not.toBeInTheDocument();
  });

  it("renders nothing when no category has products", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ items: [TREE.items[0]] })),
    );
    expect(await CategoryNav()).toBeNull();
  });

  it("renders nothing and logs a safe line when the backend is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("connect ECONNREFUSED")));

    expect(await CategoryNav()).toBeNull();
    expect(console.error).toHaveBeenCalledWith("category_nav_failed kind=network status=-");
  });

  it("treats an unreadable response body as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => {
          throw new SyntaxError("Unexpected token");
        },
      }),
    );
    await expect(CategoryNav()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "category_nav_failed kind=invalid_response status=200",
    );
  });
});
