import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackendStatus } from "@/components/status/backend-status";

// connection() needs a real request scope; outside Next it only marks the render dynamic.
vi.mock("next/server", () => ({ connection: async () => {} }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BackendStatus", () => {
  it("shows healthy when the backend answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    );

    render(await BackendStatus());

    expect(screen.getByRole("status")).toHaveTextContent("Backend service: healthy");
  });

  it("shows a friendly unavailable state without raw error text when the backend is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("connect ECONNREFUSED")));

    render(await BackendStatus());

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("unavailable");
    expect(status).not.toHaveTextContent(/ECONNREFUSED|TypeError|Error/);
  });
});
