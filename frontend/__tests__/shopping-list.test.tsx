import { act, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddToListButton } from "@/components/referral/add-to-list-button";
import { ListIndicator } from "@/components/referral/list-indicator";
import { ShoppingListProvider } from "@/components/referral/shopping-list-provider";
import { ShoppingListView } from "@/components/referral/shopping-list-view";
import {
  MAX_ITEMS,
  MAX_QUANTITY,
  STORAGE_KEY,
  type ListItem,
  type ListStorage,
  addItem,
  browserStorage,
  indicativeTotal,
  itemCount,
  parseStored,
  removeItem,
  serialise,
  setQuantity,
} from "@/lib/shopping-list";

import { jsonResponse, productDetailPayload } from "./catalogue-fixtures";
import { memoryStorage } from "./test-render";

const CREAM = { slug: "sample-product-01", name: "Sample Product 01", price_pkr: "100.00" };
const BALM = { slug: "sample-product-02", name: "Sample Product 02", price_pkr: "250.50" };
const OIL = { slug: "sample-product-03", name: "Sample Product 03", price_pkr: null };

const item = (product: typeof CREAM | typeof OIL, quantity = 1): ListItem => ({ ...product, quantity });

function renderWith(storage: ListStorage, ui: React.ReactNode) {
  return rtlRender(<ShoppingListProvider storage={storage}>{ui}</ShoppingListProvider>);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Pure list logic ------------------------------------------------------------------

describe("list logic", () => {
  it("adds, increments, clamps and removes items", () => {
    let items = addItem([], CREAM);
    items = addItem(items, CREAM);
    items = addItem(items, BALM);
    expect(items.map((i) => [i.slug, i.quantity])).toEqual([
      ["sample-product-01", 2],
      ["sample-product-02", 1],
    ]);
    expect(setQuantity(items, CREAM.slug, 0)[0]?.quantity).toBe(1);
    expect(setQuantity(items, CREAM.slug, 500)[0]?.quantity).toBe(MAX_QUANTITY);
    expect(setQuantity(items, CREAM.slug, Number.NaN)[0]?.quantity).toBe(1);
    expect(removeItem(items, CREAM.slug).map((i) => i.slug)).toEqual([BALM.slug]);
    expect(itemCount(items)).toBe(3);
  });

  it(`stops adding new products at ${MAX_ITEMS}`, () => {
    const full = Array.from({ length: MAX_ITEMS }, (_, n) => item({ ...CREAM, slug: `p-${n}` }));
    expect(addItem(full, BALM)).toHaveLength(MAX_ITEMS);
  });

  it("totals exactly in paisa and counts unpriced items", () => {
    const items = [item({ ...CREAM, price_pkr: "0.10" }, 3), item(BALM, 2), item(OIL, 4)];
    expect(indicativeTotal(items)).toEqual({ amount: "501.30", unpriced: 1 });
    expect(indicativeTotal([])).toEqual({ amount: "0.00", unpriced: 0 });
  });

  it("round-trips stored data", () => {
    const items = [item(CREAM, 2), item(OIL)];
    expect(parseStored(serialise(items))).toEqual(items);
  });

  it.each([
    ["missing", null],
    ["not JSON", "{oops"],
    ["another version", JSON.stringify({ version: 2, items: [item(CREAM)] })],
    ["wrong shape", JSON.stringify({ version: 1, items: "x" })],
    ["invalid item", JSON.stringify({ version: 1, items: [{ ...item(CREAM), quantity: 0 }] })],
    ["bad slug", JSON.stringify({ version: 1, items: [{ ...item(CREAM), slug: "<script>" }] })],
    ["extra address field", JSON.stringify({ version: 1, items: [{ ...item(CREAM), address: "x" }] })],
  ])("discards %s data safely", (_, raw) => {
    expect(parseStored(raw)).toEqual(
      raw?.includes("address") ? [item(CREAM)] : [], // unknown fields are stripped, not kept
    );
  });

  it("drops duplicate slugs, keeping the first", () => {
    const raw = JSON.stringify({ version: 1, items: [item(CREAM, 2), item(CREAM, 5)] });
    expect(parseStored(raw)).toEqual([item(CREAM, 2)]);
  });
});

describe("browserStorage", () => {
  it("uses localStorage under the versioned key", () => {
    const storage = browserStorage();
    expect(storage.available()).toBe(true);
    expect(storage.write("x")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("x");
    expect(storage.read()).toBe("x");
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("reports blocked or full storage instead of throwing", () => {
    const blocked = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    const storage = browserStorage();
    expect(storage.available()).toBe(false);
    expect(storage.write("x")).toBe(false);
    expect(storage.read()).toBeNull();
  });
});

// --- Components -------------------------------------------------------------------------

describe("Add to list and the header indicator", () => {
  it("adds items, updates the count and announces each change", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { container } = renderWith(
      storage,
      <>
        <ListIndicator />
        <AddToListButton product={CREAM} />
      </>,
    );

    const indicator = screen.getByRole("link", { name: "Shopping list, 0 items" });
    expect(indicator).toHaveAttribute("href", "/list");

    await user.click(screen.getByRole("button", { name: "Add to list: Sample Product 01" }));
    expect(screen.getByRole("link", { name: "Shopping list, 1 item" })).toHaveTextContent("List (1)");
    expect(screen.getByRole("link", { name: "1 in your list" })).toHaveAttribute("href", "/list");
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent("Sample Product 01 added to your list.");

    await user.keyboard("{Enter}"); // still focused: keyboard operable
    expect(screen.getByRole("link", { name: "Shopping list, 2 items" })).toBeInTheDocument();
    expect(parseStored(storage.value())).toEqual([item(CREAM, 2)]);
  });

  it("persists across reloads", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const first = renderWith(storage, <AddToListButton product={BALM} />);
    await user.click(screen.getByRole("button"));
    first.unmount();

    renderWith(storage, <ListIndicator />); // a fresh provider, as after a reload
    expect(screen.getByRole("link", { name: "Shopping list, 1 item" })).toBeInTheDocument();
  });

  it("follows changes made in another tab", () => {
    const storage = memoryStorage();
    renderWith(storage, <ListIndicator />);

    storage.write(serialise([item(CREAM, 3)]));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

    expect(screen.getByRole("link", { name: "Shopping list, 3 items" })).toBeInTheDocument();
  });

  it("never makes a network request when the list changes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWith(memoryStorage(), <AddToListButton product={CREAM} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ShoppingListView", () => {
  function stubProducts(responses: Record<string, Response | Error>) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const slug = url.pathname.split("/").pop() ?? "";
      const response = responses[slug] ?? jsonResponse({ detail: "Product not found" }, 404);
      if (response instanceof Error) throw response;
      expect(init?.method ?? "GET").toBe("GET");
      return response.clone();
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const current = (product: typeof CREAM | typeof OIL) =>
    jsonResponse({ ...productDetailPayload(), slug: product.slug, name: product.name, price_pkr: product.price_pkr });

  it("shows an empty state", () => {
    stubProducts({});
    renderWith(memoryStorage(), <ShoppingListView />);
    expect(screen.getByText("Your list is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute("href", "/products");
  });

  it("lists items with an indicative total, and changes them by keyboard", async () => {
    const user = userEvent.setup();
    stubProducts({ [CREAM.slug]: current(CREAM), [BALM.slug]: current(BALM), [OIL.slug]: current(OIL) });
    const storage = memoryStorage(serialise([item(CREAM, 2), item(BALM), item(OIL)]));
    const { container } = renderWith(storage, <ShoppingListView />);

    const list = screen.getByRole("list", { name: "Items in your list" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: /Indicative total: Rs.450.50/ })).toBeInTheDocument();
    expect(screen.getByText(/Indicative — final price on Oriflame\. 4 items\./)).toBeInTheDocument();
    expect(screen.getByText(/1 product has no price here and is not included/)).toBeInTheDocument();
    expect(container.querySelector('[data-slot="referral-handoff"]')).not.toBeNull();

    screen.getByRole("button", { name: "Increase quantity of Sample Product 02" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status", { name: "Quantity of Sample Product 02" })).toHaveTextContent("2");
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      "Sample Product 02: quantity 2.",
    );

    expect(screen.getByRole("button", { name: "Decrease quantity of Sample Product 03" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remove Sample Product 03 from your list" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(parseStored(storage.value()).map((i) => [i.slug, i.quantity])).toEqual([
      [CREAM.slug, 2],
      [BALM.slug, 2],
    ]);
  });

  it("has no address, payment or other input fields", () => {
    stubProducts({ [CREAM.slug]: current(CREAM) });
    const { container } = renderWith(memoryStorage(serialise([item(CREAM)])), <ShoppingListView />);
    expect(container.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
    expect(container.textContent).toMatch(/never ask for your address or payment details/);
  });

  it("flags products that are no longer available or whose price changed", async () => {
    stubProducts({
      [CREAM.slug]: jsonResponse({ detail: "Product not found" }, 404),
      [BALM.slug]: jsonResponse({ ...productDetailPayload(), slug: BALM.slug, price_pkr: "300.00" }),
    });
    const storage = memoryStorage(serialise([item(CREAM), item(BALM)]));
    renderWith(storage, <ShoppingListView />);

    expect(await screen.findByText("No longer available on this site.")).toBeInTheDocument();
    expect(await screen.findByText(/Price updated: was Rs.250.50, now Rs.300/)).toBeInTheDocument();
    await waitFor(() =>
      expect(parseStored(storage.value()).find((i) => i.slug === BALM.slug)?.price_pkr).toBe("300.00"),
    );
    // The unavailable product leaves the total; the updated price is used.
    expect(screen.getByRole("heading", { name: /Indicative total: Rs.300$/ })).toBeInTheDocument();
    expect(screen.getByText(/1 product is no longer available\s+and not included/)).toBeInTheDocument();
  });

  it("checks each product with its own GET and never sends the list", async () => {
    const fetchMock = stubProducts({ [CREAM.slug]: current(CREAM), [BALM.slug]: current(BALM) });
    renderWith(memoryStorage(serialise([item(CREAM, 7), item(BALM, 3)])), <ShoppingListView />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls.map((url) => url.pathname).sort()).toEqual([
      `/api/v1/products/${CREAM.slug}`,
      `/api/v1/products/${BALM.slug}`,
    ]);
    expect(urls.every((url) => url.search === "")).toBe(true); // no quantities or other items
    expect(screen.queryByText(/No longer available|Price updated/)).not.toBeInTheDocument();
  });

  it.each([
    ["the network fails", new TypeError("offline")],
    ["the response is malformed", jsonResponse({ unexpected: true })],
  ])("leaves items unflagged when %s", async (_, failure) => {
    const fetchMock = stubProducts({ [CREAM.slug]: failure });
    renderWith(memoryStorage(serialise([item(CREAM)])), <ShoppingListView />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/No longer available|Price updated/)).not.toBeInTheDocument();
  });

  it("falls back to memory with a notice when the browser refuses storage", async () => {
    const user = userEvent.setup();
    stubProducts({ [CREAM.slug]: current(CREAM) });
    const storage = memoryStorage(null, { fail: true });
    renderWith(
      storage,
      <>
        <AddToListButton product={CREAM} />
        <ShoppingListView />
      </>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/will be lost when you leave/);
    await user.click(screen.getByRole("button", { name: "Add to list: Sample Product 01" }));
    expect(screen.getByRole("list", { name: "Items in your list" })).toHaveTextContent("Sample Product 01");
  });

  it("discards corrupted stored data and starts empty", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderWith(memoryStorage("{not json"), <ShoppingListView />);
    expect(screen.getByText("Your list is empty.")).toBeInTheDocument();
  });
});
