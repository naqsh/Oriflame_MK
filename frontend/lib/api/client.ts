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

/** Send the request and return the parsed JSON body, unvalidated. */
async function requestBody(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
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

  try {
    return await response.json();
  } catch {
    throw new ApiError(
      "invalid_response",
      `${method} ${path} returned invalid JSON`,
      response.status,
    );
  }

}

/** Validate a JSON body with `schema`; `label` (e.g. "GET /path") is for the error message. */
export function validateBody<Schema extends z.ZodType>(
  label: string,
  schema: Schema,
  body: unknown,
): z.infer<Schema> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("invalid_response", `${label} response did not match schema`, 200);
  }
  return parsed.data;
}

/** GET `path` and return its JSON body unvalidated (for callers that validate later). */
export function readJson(
  path: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<unknown> {
  return requestBody("GET", path, undefined, timeoutMs);
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
  return requestBody("GET", path, undefined, timeoutMs).then((body) =>
    validateBody(`GET ${path}`, schema, body),
  );
}

/** POST a JSON `body` to `path` and validate the response with `schema`. */
export function postJson<Schema extends z.ZodType>(
  path: string,
  body: unknown,
  schema: Schema,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<z.infer<Schema>> {
  return requestBody("POST", path, body, timeoutMs).then((json) =>
    validateBody(`POST ${path}`, schema, json),
  );
}

/** Resolve to null on 404, so pages can call notFound(). Other failures throw. */
export async function orNotFound<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
