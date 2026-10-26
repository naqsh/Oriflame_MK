import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

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
