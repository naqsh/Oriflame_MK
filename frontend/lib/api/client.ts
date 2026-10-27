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

async function requestJson<Schema extends z.ZodType>(
  method: "GET" | "POST",
  path: string,
  schema: Schema,
  body: unknown,
  timeoutMs: number,
): Promise<z.infer<Schema>> {
  const url = `${getApiBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers:
        method === "POST"
          ? { Accept: "application/json", "Content-Type": "application/json" }
          : { Accept: "application/json" },
      body: method === "POST" ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Match by name: the DOMException class differs between runtimes (Node, jsdom).
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError("timeout", `${method} ${path} timed out after ${timeoutMs} ms`);
    }
    throw new ApiError("network", `${method} ${path} failed: ${String(error)}`);
  }

  if (!response.ok) {
    throw new ApiError("http", `${method} ${path} returned ${response.status}`, response.status);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await response.json();
  } catch {
    throw new ApiError(
      "invalid_response",
      `${method} ${path} returned invalid JSON`,
      response.status,
    );
  }

  const parsed = schema.safeParse(parsedBody);
  if (!parsed.success) {
    throw new ApiError(
      "invalid_response",
      `${method} ${path} response did not match schema`,
      response.status,
    );
  }
  return parsed.data;
}

/**
 * GET `path` from the backend and validate the JSON body with `schema`.
 * Extra fields are stripped by Zod; missing or wrong fields raise ApiError.
 */
export function fetchJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<z.infer<Schema>> {
  return requestJson("GET", path, schema, undefined, timeoutMs);
}

/** POST a JSON `body` to `path` and validate the response with `schema`. */
export function postJson<Schema extends z.ZodType>(
  path: string,
  body: unknown,
  schema: Schema,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<z.infer<Schema>> {
  return requestJson("POST", path, schema, body, timeoutMs);
}
