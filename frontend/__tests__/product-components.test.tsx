import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DevDataBanner } from "@/components/layout/dev-data-banner";
import { AvailabilityBadge } from "@/components/product/availability-badge";
import { Price, formatPrice } from "@/components/product/price";
import { ProductCard } from "@/components/product/product-card";
import { ProductGrid } from "@/components/product/product-grid";

import { productSummary } from "./catalogue-fixtures";
import { render } from "./test-render";

const NBSP = /\s/;

describe("Price", () => {
  it.each([
    ["1499.00", "Rs 1,499"],
    ["999.50", "Rs 999.50"],
    ["250000.00", "Rs 250,000"],
  ])("formats %s as PKR", (value, expected) => {
    expect(formatPrice(value).replace(NBSP, " ")).toBe(expected);
  });

  it("shows 'Price not available' for a missing or unreadable price, never 0", () => {
    expect(formatPrice(null)).toBe("Price not available");
    expect(formatPrice("abc")).toBe("Price not available");
    render(<Price value={null} />);
    expect(screen.getByText("Price not available")).toBeInTheDocument();
  });
});

describe("AvailabilityBadge", () => {
  it("shows the not-confirmed label without a check time", () => {
    render(
      <AvailabilityBadge
        availability={{ status: "not_confirmed", label: "Availability not confirmed", checked_at: null }}
      />,
    );
    expect(screen.getByText("Availability not confirmed")).toBeInTheDocument();
    expect(screen.queryByText(/checked/)).not.toBeInTheDocument();
  });

  it.each([
    ["verified_in_stock", "In stock at Oriflame when last checked"],
    ["verified_out_of_stock", "Out of stock at Oriflame when last checked"],
  ] as const)("shows %s with its label and the check time", (status, label) => {
    const { container } = render(
      <AvailabilityBadge
        availability={{ status, label, checked_at: "2026-10-27T07:00:00Z" }}
      />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("dateTime", "2026-10-27T07:00:00Z");
    expect(time?.textContent).toMatch(/27.Oct.2026/);
  });
});

describe("ProductCard", () => {
  it("is one link named after the product, to its page", () => {
    render(<ProductCard product={productSummary()} />);
    const link = screen.getByRole("link", { name: "Sample Product 01" });
    expect(link).toHaveAttribute("href", "/products/sample-product-01");
    expect(within(link).getByText(/Rs.1,499/)).toBeInTheDocument();
    expect(within(link).getByText("Availability not confirmed")).toBeInTheDocument();
  });

  it("renders a local development placeholder image with its alt text", () => {
    render(<ProductCard product={productSummary()} />);
    const image = screen.getByRole("img", { name: "Placeholder image for Sample Product 01" });
    expect(image.getAttribute("src")).toContain("/dev-fixture/sample-product.svg");
  });

  it("uses a placeholder instead of an image from an unauthorised host", () => {
    const product = productSummary({
      primary_image: { url: "https://media-cdn.oriflame.com/productImage?id=1", alt_text: "Real photo" },
    });
    const { container } = render(<ProductCard product={product} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "No image available for Sample Product 01" })).toBeInTheDocument();
  });

  it("uses a placeholder when there is no image", () => {
    render(<ProductCard product={productSummary({ primary_image: null })} />);
    expect(screen.getByRole("img", { name: /No image available/ })).toBeInTheDocument();
  });

  it("falls back to the product name for empty alt text", () => {
    const product = productSummary({
      primary_image: { url: "http://localhost:3000/dev-fixture/sample-product.svg", alt_text: "  " },
    });
    render(<ProductCard product={product} />);
    expect(screen.getAllByRole("img", { name: "Sample Product 01" })).toHaveLength(1);
  });

  it("keeps a very long name fully accessible while clamping it visually", () => {
    const name = `Sample Product ${"with a very long descriptive name ".repeat(8)}`.trim();
    render(<ProductCard product={productSummary({ name })} />);
    expect(screen.getByRole("link", { name })).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent(name);
    expect(heading).toHaveAttribute("title", name);
    expect(heading).toHaveClass("line-clamp-2");
  });
});

describe("ProductGrid", () => {
  it("lists one card per product", () => {
    render(
      <ProductGrid
        products={[productSummary(), productSummary({ slug: "sample-product-02", name: "Sample Product 02" })]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the empty message when there are no products", () => {
    render(<ProductGrid products={[]} emptyMessage="Nothing here yet." />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("DevDataBanner", () => {
  it("renders when any item is development fixture data", () => {
    render(
      <DevDataBanner
        items={[
          productSummary({ data_source: "permitted_feed", is_development_data: false }),
          productSummary(),
        ]}
      />,
    );
    const banner = screen.getByRole("complementary", { name: "Development data notice" });
    expect(banner).toHaveTextContent(/not live\s+Oriflame products/);
  });

  it("recognises fixture data by its source name alone", () => {
    render(<DevDataBanner items={[{ data_source: "dev_fixture" }]} />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("renders nothing for real or empty data", () => {
    render(
      <DevDataBanner items={[productSummary({ data_source: "permitted_feed", is_development_data: false })]} />,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    render(<DevDataBanner items={[]} />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
