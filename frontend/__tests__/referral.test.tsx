import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BuyFromOriflame, HANDOFF_ERROR } from "@/components/referral/buy-from-oriflame";
import { CurrentReferralSteps, ReferralSteps } from "@/components/referral/referral-steps";
import { requestHandoff } from "@/lib/api/referral";

import { jsonResponse } from "./catalogue-fixtures";

vi.mock("next/server", () => ({ connection: async () => {} }));

const REFERRAL_URL = "https://pk.oriflame.com/join?ref=abc";
const FAKE_CODE = "TESTCODE-0000";
const OFFICIAL = { method: "official_url", url: REFERRAL_URL, note: "You are continuing to Oriflame." };
const MANUAL = {
  method: "manual_code",
  code: FAKE_CODE,
  instructions: ["Continue to Oriflame.", "Enter the code shown here.", "Checkout is on Oriflame."],
  checkout_url: "https://pk.oriflame.com/",
};
const UNAVAILABLE = {
  method: "unavailable",
  reason: "not_configured",
  message: "You can complete your purchase on Oriflame's official Pakistan website.",
  fallback_url: "https://pk.oriflame.com/",
};

function stubHandoff(body: unknown, status = 200) {
  // A fresh Response per call: a body can only be read once.
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => jsonResponse(body, status),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>): unknown {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(String(init.body));
}

const dialog = () => screen.getByRole("dialog", { hidden: true });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestHandoff", () => {
  it("POSTs only the origin, slug and item count, never a destination", async () => {
    const fetchMock = stubHandoff(UNAVAILABLE);

    await requestHandoff({ origin: "pdp", productSlug: "sample-product-01", itemCount: 999 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/v1/referral/handoff");
    expect(init.method).toBe("POST");
    expect(sentBody(fetchMock)).toEqual({
      origin: "pdp",
      product_slug: "sample-product-01",
      item_count: 200,
    });
  });

  it("rejects a handoff with a non-https destination", async () => {
    stubHandoff({ ...OFFICIAL, url: "http://pk.oriflame.com/x" });
    await expect(requestHandoff({ origin: "pdp" })).rejects.toMatchObject({ kind: "invalid_response" });
  });
});

describe("BuyFromOriflame", () => {
  it("opens the server's official URL in a new tab, without an opener", async () => {
    const user = userEvent.setup();
    const fetchMock = stubHandoff(OFFICIAL);
    const opened = { opener: window as unknown };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
    render(<BuyFromOriflame origin="pdp" productSlug="sample-product-01" />);

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));

    expect(openSpy).toHaveBeenCalledWith(REFERRAL_URL, "_blank");
    expect(opened.opener).toBeNull();
    expect(dialog()).not.toHaveAttribute("open");
    expect(sentBody(fetchMock)).toMatchObject({ origin: "pdp", product_slug: "sample-product-01" });
  });

  it("falls back to a same-tab link when the pop-up is blocked", async () => {
    const user = userEvent.setup();
    stubHandoff(OFFICIAL);
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<BuyFromOriflame origin="pdp" />);

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));

    expect(dialog()).toHaveAttribute("open");
    expect(within(dialog()).getByText(/blocked the new tab/)).toBeInTheDocument();
    const link = within(dialog()).getByRole("link", { name: "Continue to Oriflame", hidden: true });
    expect(link).toHaveAttribute("href", REFERRAL_URL);
    expect(link).not.toHaveAttribute("target");
  });

  it("shows the list's items to re-add, with a copy action and a new-tab link", async () => {
    const user = userEvent.setup();
    const fetchMock = stubHandoff(OFFICIAL);
    const openSpy = vi.spyOn(window, "open");
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(
      <BuyFromOriflame
        origin="list"
        items={[
          { name: "Sample Product 01", quantity: 2 },
          { name: "Sample Product 02", quantity: 1 },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));

    expect(openSpy).not.toHaveBeenCalled();
    expect(sentBody(fetchMock)).toMatchObject({ origin: "list", item_count: 3 });
    const items = within(dialog()).getByRole("region", { name: "Items to add on Oriflame", hidden: true });
    expect(within(items).getAllByRole("listitem", { hidden: true }).map((li) => li.textContent)).toEqual([
      "2 × Sample Product 01",
      "1 × Sample Product 02",
    ]);
    await user.click(within(items).getByRole("button", { name: "Copy list", hidden: true }));
    expect(writeText).toHaveBeenCalledWith("2 x Sample Product 01\n1 x Sample Product 02");
    const link = within(dialog()).getByRole("link", { name: "Continue to Oriflame", hidden: true });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows manual-code instructions and copies the code by keyboard", async () => {
    const user = userEvent.setup();
    stubHandoff(MANUAL);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<BuyFromOriflame origin="referral_page" />);

    screen.getByRole("button", { name: "Buy from Oriflame" }).focus();
    await user.keyboard("{Enter}");

    const box = dialog();
    expect(box).toHaveAttribute("open");
    expect(box).toHaveAttribute("aria-modal", "true");
    expect(within(box).getByRole("heading", { name: "Continue on Oriflame", hidden: true })).toBeInTheDocument();
    expect(within(box).getAllByRole("listitem", { hidden: true })).toHaveLength(3);
    expect(within(box).getByText(FAKE_CODE)).toBeInTheDocument();

    within(box).getByRole("button", { name: "Copy code", hidden: true }).focus();
    await user.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledWith(FAKE_CODE);
    expect(within(box).getByText("Code copied.")).toBeInTheDocument();
    expect(within(box).getByRole("link", { name: "Continue to Oriflame", hidden: true })).toHaveAttribute(
      "href",
      "https://pk.oriflame.com/",
    );
  });

  it("shows the code selected with a Ctrl+C hint when copying is blocked", async () => {
    const user = userEvent.setup();
    stubHandoff(MANUAL);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) },
    });
    render(<BuyFromOriflame origin="pdp" />);

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));
    await user.click(within(dialog()).getByRole("button", { name: "Copy code", hidden: true }));

    const field = within(dialog()).getByRole("textbox", { name: /Press Ctrl\+C/, hidden: true });
    expect(field).toHaveValue(FAKE_CODE);
    expect(field).toHaveAttribute("readonly");
  });

  it("explains restricted mode calmly and links to the official site", async () => {
    const user = userEvent.setup();
    stubHandoff(UNAVAILABLE);
    render(<BuyFromOriflame origin="pdp" />);

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));

    expect(within(dialog()).getByText(UNAVAILABLE.message)).toBeInTheDocument();
    expect(within(dialog()).getByRole("link", { name: "Continue to Oriflame", hidden: true })).toHaveAttribute(
      "href",
      "https://pk.oriflame.com/",
    );
  });

  it("closes with Escape and with the Close button", async () => {
    const user = userEvent.setup();
    stubHandoff(UNAVAILABLE);
    render(<BuyFromOriflame origin="pdp" />);

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));
    expect(dialog()).toHaveAttribute("open");
    act(() => {
      dialog().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dialog()).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));
    await user.click(within(dialog()).getByRole("button", { name: "Close", hidden: true }));
    expect(dialog()).not.toHaveAttribute("open");
  });

  it("offers a retry on network failure and never guesses a URL", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(jsonResponse(UNAVAILABLE));
    vi.stubGlobal("fetch", fetchMock);
    const openSpy = vi.spyOn(window, "open");
    const { container } = render(<BuyFromOriflame origin="pdp" />);

    await user.click(screen.getByRole("button", { name: "Buy from Oriflame" }));

    expect(screen.getByRole("alert")).toHaveTextContent(HANDOFF_ERROR);
    expect(openSpy).not.toHaveBeenCalled();
    expect(container.querySelector("a")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(dialog()).toHaveAttribute("open");
  });
});

describe("ReferralSteps", () => {
  it.each([
    ["official_url", 3, false],
    ["unavailable", 3, false],
    [null, 3, false],
    ["manual_code", 4, true],
  ] as const)("shows the right steps for %s", (method, count, mentionsCode) => {
    render(<ReferralSteps method={method} />);
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(count);
    expect(steps.some((step) => /consultant or Brand Partner code/.test(step.textContent ?? ""))).toBe(
      mentionsCode,
    );
    expect(steps.at(-1)).toHaveTextContent(/check out, pay and arrange delivery with Oriflame/);
  });

  it("reads the mode from the backend, and falls back to generic steps", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ method: "manual_code" })));
    render(await CurrentReferralSteps());
    expect(screen.getAllByRole("listitem")).toHaveLength(4);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { container } = render(await CurrentReferralSteps());
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(console.error).toHaveBeenCalledWith("referral_mode_failed kind=network status=-");
  });
});

describe("referral source hygiene", () => {
  const root = join(__dirname, "..");
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  }

  it("never hard-codes an Oriflame URL or reads referral settings in the frontend", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(join(root, dir)))
      .filter((file) => /oriflame\.com|ORIFLAME_(CONSULTANT_CODE|REFERRAL_URL)|consultant_code/.test(readFileSync(file, "utf-8")));
    expect(offenders).toEqual([]);
  });
});
