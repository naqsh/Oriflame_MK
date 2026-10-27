import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductImage } from "@/components/product/product-image";
import { WebVitals } from "@/components/status/web-vitals";

type Metric = { name: string; value: number; rating: string };
let reporter: ((metric: Metric) => void) | null = null;

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (fn: (metric: Metric) => void) => {
    reporter = fn;
  },
}));

const FIXTURE_IMAGE = {
  url: "http://localhost:8000/dev-fixture/sample-product-01.png", // raster: SVGs skip srcset/sizes
  alt_text: "Placeholder image",
  position: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
  reporter = null;
});

describe("ProductImage sizing", () => {
  it("uses the listing-grid sizes by default", () => {
    render(<ProductImage image={FIXTURE_IMAGE} productName="Sample" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "sizes",
      "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
    );
  });

  it("accepts page-specific sizes and keeps explicit dimensions against layout shift", () => {
    render(<ProductImage image={FIXTURE_IMAGE} productName="Sample" sizes="100vw" preload />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("sizes", "100vw");
    expect(img).toHaveAttribute("width", "600");
    expect(img).toHaveAttribute("height", "600");
    // Preloaded images are fetched eagerly rather than lazily.
    expect(img).not.toHaveAttribute("loading", "lazy");
  });

  it("lazy-loads images that are not preloaded", () => {
    render(<ProductImage image={FIXTURE_IMAGE} productName="Sample" />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });
});

describe("WebVitals", () => {
  it("logs each metric to the console and renders nothing", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { container } = render(<WebVitals />);

    reporter?.({ name: "LCP", value: 1234.5678, rating: "good" });

    expect(container).toBeEmptyDOMElement();
    expect(info).toHaveBeenCalledWith("web-vital LCP=1234.57 rating=good");
  });

  it("is mounted only in development and sends nothing over the network", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    // A dynamic import behind a build-time constant: a static import of a client module
    // would ship its chunk to every page even though production never renders it.
    expect(layout).toMatch(
      /process\.env\.NODE_ENV === "development"\s*\? \(await import\("@\/components\/status\/web-vitals"\)\)/,
    );
    expect(layout).not.toMatch(/^import .*web-vitals/m);
    const source = readFileSync(join(process.cwd(), "components/status/web-vitals.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest/);
  });
});
