import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteShell } from "@/components/layout/site-shell";
import { SITE_NAME } from "@/lib/seo/site";

describe("SiteShell", () => {
  it("renders banner, main and contentinfo landmarks", () => {
    render(
      <SiteShell>
        <p>Page content</p>
      </SiteShell>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("Page content")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("links the site name to the homepage", () => {
    render(<SiteShell>content</SiteShell>);

    const home = within(screen.getByRole("banner")).getByRole("link", { name: SITE_NAME });
    expect(home).toHaveAttribute("href", "/");
  });

  it("has a search form that sends q to /search", () => {
    render(<SiteShell>content</SiteShell>);

    const form = within(screen.getByRole("banner")).getByRole("search");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    const input = within(form).getByRole("searchbox", { name: "Search products" });
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("maxLength", "100");
    expect(input).toBeRequired();
    expect(within(form).getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("shows the independent-storefront disclaimer in the footer", () => {
    render(<SiteShell>content</SiteShell>);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText(/not the official Oriflame website/i)).toBeInTheDocument();
    expect(within(footer).getByText(/not affiliated with or endorsed by Oriflame/i)).toBeInTheDocument();
  });
});
