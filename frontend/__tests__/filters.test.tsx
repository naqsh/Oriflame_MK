import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilterPanel } from "@/components/filters/filter-panel";
import { Pagination } from "@/components/filters/pagination";
import { SortSelect } from "@/components/filters/sort-select";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listingHref } from "@/lib/listing";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const CATEGORIES = [
  { slug: "face", label: "Face" },
  { slug: "eyes", label: "— Eyes" },
];

beforeEach(() => {
  push.mockReset();
});

describe("FilterPanel", () => {
  it("has labelled, keyboard-operable fields showing the current filters", () => {
    render(
      <FilterPanel
        basePath="/products"
        params={{ category: "eyes", minPrice: "100", sort: "price_asc", page: 2 }}
        categories={CATEGORIES}
      />,
    );

    const form = screen.getByRole("form", { name: "Filter products" });
    expect(form).toHaveAttribute("action", "/products");
    expect(form).toHaveAttribute("method", "get");
    expect(within(form).getByRole("combobox", { name: "Category" })).toHaveValue("eyes");
    expect(within(form).getByRole("spinbutton", { name: "Min price (Rs)" })).toHaveValue(100);
    expect(within(form).getByRole("spinbutton", { name: "Max price (Rs)" })).toHaveValue(null);
  });

  it("applies filters by keyboard, keeps the sort and resets to page 1", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        basePath="/products"
        params={{ sort: "price_asc", page: 3 }}
        categories={CATEGORIES}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "face");
    await user.type(screen.getByRole("spinbutton", { name: "Min price (Rs)" }), "200");
    await user.type(screen.getByRole("spinbutton", { name: "Max price (Rs)" }), "900{Enter}");

    expect(push).toHaveBeenCalledWith(
      "/products?category=face&min_price=200&max_price=900&sort=price_asc",
    );
  });

  it("offers no category filter on category pages", async () => {
    const user = userEvent.setup();
    render(<FilterPanel basePath="/categories/face" params={{ sort: "name_asc", page: 1 }} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(push).toHaveBeenCalledWith("/categories/face");
  });
});

describe("SortSelect", () => {
  it("changes the sort, keeps filters and returns to page 1", async () => {
    const user = userEvent.setup();
    render(
      <SortSelect
        basePath="/products"
        params={{ category: "face", maxPrice: "500", sort: "name_asc", page: 4 }}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveValue("name_asc");
    await user.selectOptions(select, "price_desc");

    expect(push).toHaveBeenCalledWith("/products?category=face&max_price=500&sort=price_desc");
  });
});

describe("Pagination", () => {
  it("links previous and next pages with rel attributes", () => {
    render(
      <Pagination
        page={2}
        total={60}
        pageSize={24}
        hrefFor={(page) => listingHref("/products", { sort: "newest", page })}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("link", { name: "Previous page" })).toHaveAttribute("rel", "prev");
    expect(within(nav).getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/products?sort=newest",
    );
    expect(within(nav).getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/products?sort=newest&page=3",
    );
    expect(within(nav).getByRole("link", { name: "Next page" })).toHaveAttribute("rel", "next");
    expect(within(nav).getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("disables the missing direction on the first and last page", () => {
    const { rerender } = render(
      <Pagination page={1} total={30} pageSize={24} hrefFor={(page) => listingHref("/p", { page })} />,
    );
    expect(screen.queryByRole("link", { name: "Previous page" })).not.toBeInTheDocument();
    expect(screen.getByText("Previous page")).toHaveAttribute("aria-disabled", "true");

    rerender(
      <Pagination page={2} total={30} pageSize={24} hrefFor={(page) => listingHref("/p", { page })} />,
    );
    expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("is hidden when everything fits on one page", () => {
    const { container } = render(
      <Pagination page={1} total={5} pageSize={24} hrefFor={(page) => listingHref("/p", { page })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("points back into range from a page beyond the last", () => {
    render(
      <Pagination page={9} total={30} pageSize={24} hrefFor={(page) => listingHref("/p", { page })} />,
    );
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/p?page=2");
  });
});

describe("Breadcrumbs", () => {
  it("links ancestors and marks the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Face", href: "/categories/face" },
          { name: "Eyes", href: "/categories/eyes" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Home", "Face"]);
    expect(within(nav).getByText("Eyes")).toHaveAttribute("aria-current", "page");
  });
});
