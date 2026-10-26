import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, fetchJson, getApiBaseUrl } from "@/lib/api/client";
import { healthResponseSchema } from "@/lib/api/schemas/health";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function expectApiError(promise: Promise<unknown>, kind: ApiError["kind"]) {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).kind).toBe(kind);
  return error as ApiError;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchJson", () => {
  it("returns parsed data for a valid payload and calls the configured base URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.test:8000/");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("/health", healthResponseSchema)).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test:8000/health", expect.anything());
  });

  it("strips extra fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "ok", extra: 1 })));

    await expect(fetchJson("/health", healthResponseSchema)).resolves.toEqual({ status: "ok" });
  });

  it("throws ApiError when required fields are missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ healthy: true })));

    await expectApiError(fetchJson("/health", healthResponseSchema), "invalid_response");
  });

  it("throws ApiError on a body that is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));

    await expectApiError(fetchJson("/health", z.unknown()), "invalid_response");
  });

  it("throws ApiError with the status on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "x" }, 503)));

    const error = await expectApiError(fetchJson("/health", healthResponseSchema), "http");
    expect(error.status).toBe(503);
  });

  it("throws ApiError on timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );

    await expectApiError(fetchJson("/health", healthResponseSchema, { timeoutMs: 10 }), "timeout");
  });

  it("throws ApiError when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expectApiError(fetchJson("/health", healthResponseSchema), "network");
  });
});

describe("getApiBaseUrl", () => {
  it("defaults to the local API outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("is required in production", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getApiBaseUrl()).toThrow(ApiError);
  });
});
