import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// cacheLife() only runs inside a Next.js "use cache" scope; outside Next.js the
// directive is a plain string, so record the call instead. Files may mock next/cache
// themselves; their mock wins.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// No real network in unit tests: any fetch a test has not stubbed fails loudly.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      Promise.reject(new Error(`Network blocked in tests: ${String(input)}`)),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom has no <dialog> modal API. Browsers provide showModal()/close() (with focus
// trapping and Escape); these stand-ins only toggle `open` and fire "close".
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
