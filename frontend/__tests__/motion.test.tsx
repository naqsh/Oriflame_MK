import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  END_DELAY,
  LINE_DELAY,
  OFFSETS,
  ShortlistAnimation,
  delay,
} from "@/components/home/shortlist-animation";
import { AddToListButton } from "@/components/referral/add-to-list-button";
import { ListIndicator } from "@/components/referral/list-indicator";
import { ShoppingListProvider } from "@/components/referral/shopping-list-provider";

import { memoryStorage } from "./test-render";

const seconds = (value: string | undefined) => Number.parseFloat(value ?? "NaN");

describe("ShortlistAnimation", () => {
  it("is decorative: hidden from assistive technology and not focusable", () => {
    const { container } = rtlRender(<ShortlistAnimation />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps a fixed aspect ratio, so it cannot shift the layout while loading", () => {
    const { container } = rtlRender(<ShortlistAnimation />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 400 300");
  });

  it("marks up the finished scene, which is what reduced-motion visitors see", () => {
    const { container } = rtlRender(<ShortlistAnimation />);
    // Three ticks, three list rows and the final count; intermediate counts and the flying
    // dots are hidden by default in the stylesheet and only shown while animating.
    expect(container.querySelectorAll(".shortlist-tick")).toHaveLength(3);
    expect(container.querySelectorAll("g.shortlist-appear")).toHaveLength(3);
    expect(container.querySelectorAll(".shortlist-count")).toHaveLength(2);
    expect(container.querySelector("text.shortlist-appear")).toHaveTextContent("3");
    expect(container.querySelectorAll(".shortlist-dot")).toHaveLength(3);
    expect(container).toHaveTextContent("Pay on Oriflame's website");
  });

  it("plays the steps in order, each part within its step, then the line and its end", () => {
    const { container } = rtlRender(<ShortlistAnimation />);
    const hops = [...container.querySelectorAll<SVGElement>(".shortlist-hop")].map((el) =>
      seconds(el.style.animationDelay),
    );
    expect(hops).toEqual([0.4, 1.2, 2]);

    const rows = [...container.querySelectorAll<SVGElement>("g.shortlist-appear")].map((el) =>
      seconds(el.style.animationDelay),
    );
    expect(rows).toEqual(hops.map((start) => start + OFFSETS.land));

    expect(LINE_DELAY).toBeGreaterThan(Math.max(...rows));
    expect(END_DELAY).toBeGreaterThan(LINE_DELAY);
    expect(container.querySelector<SVGElement>(".shortlist-line")!.style.animationDelay).toBe(`${LINE_DELAY}s`);
  });

  it("delay() rounds to hundredths and keeps extra custom properties", () => {
    expect(delay(1, OFFSETS.dot, { "--dx": "10px" })).toEqual({ animationDelay: "1.45s", "--dx": "10px" });
  });
});

describe("ListIndicator bump", () => {
  function renderList() {
    const storage = memoryStorage();
    return rtlRender(
      <ShoppingListProvider storage={storage}>
        <ListIndicator />
        <AddToListButton product={{ slug: "sample-product-01", name: "Sample Product 01", price_pkr: "100.00" }} />
      </ShoppingListProvider>,
    );
  }

  it("does not bump on first render, then bumps each time the count goes up", async () => {
    const user = userEvent.setup();
    renderList();
    const count = () => screen.getByRole("link", { name: /^Shopping list/ }).querySelector("span")!;

    expect(count()).not.toHaveClass("list-bump");
    await user.click(screen.getByRole("button", { name: /^Add to list/ }));
    expect(count()).toHaveClass("list-bump");
    const first = count();

    await user.click(screen.getByRole("button", { name: /^Add to list/ }));
    // A new element, so the animation plays again.
    expect(count()).not.toBe(first);
    expect(count()).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: "Shopping list, 2 items" })).toHaveTextContent("List (2)");
  });
});
