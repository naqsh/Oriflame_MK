import type { z } from "zod";

/** Default request timeout for backend calls. */
export const DEFAULT_TIMEOUT_MS = 5000;

const DEV_API_BASE_URL = "http://localhost:8000";

export type ApiErrorKind = "config" | "network" | "timeout" | "http" | "invalid_response";

/** Typed failure from the backend client. `message` is for logs, never for visitors. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

/** Backend base URL; required in production, defaults to the local API in development. */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new ApiError("config", "NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return DEV_API_BASE_URL;
}

export interface FetchJsonOptions {
  timeoutMs?: number;
}

/**
 * GET `path` from the backend and validate the JSON body with `schema`.
 * Extra fields are stripped by Zod; missing or wrong fields raise ApiError.
 */
export async function fetchJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<z.infer<Schema>> {
  const url = `${getApiBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Match by name: the DOMException class differs between runtimes (Node, jsdom).
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError("timeout", `GET ${path} timed out after ${timeoutMs} ms`);
    }
    throw new ApiError("network", `GET ${path} failed: ${String(error)}`);
  }

  if (!response.ok) {
    throw new ApiError("http", `GET ${path} returned ${response.status}`, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("invalid_response", `GET ${path} returned invalid JSON`, response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      "invalid_response",
      `GET ${path} response did not match schema`,
      response.status,
    );
  }
  return parsed.data;
}
