/**
 * HTTP security headers for every page (OR-050), applied in next.config.ts.
 *
 * script-src keeps 'unsafe-inline': Next.js streams its bootstrap as inline scripts, and
 * a per-request nonce would disable the prerendered shells (Partial Prerendering) that
 * every route uses. Everything else is locked down: no eval in production, no plugins,
 * no framing, no foreign forms or base URLs, and network access only to this site and
 * the API. JSON-LD blocks are data, not executed, so CSP does not affect them.
 */

export interface SecurityHeaderOptions {
  /** Origin of the backend API the browser calls (the handoff endpoint). */
  apiOrigin: string | null;
  /** Hosts product images may be loaded from (lib/images.ts). */
  imageHosts: readonly string[];
  /** Development needs eval and websockets for React Refresh. */
  development: boolean;
}

export function contentSecurityPolicy({ apiOrigin, imageHosts, development }: SecurityHeaderOptions): string {
  const images = ["'self'", "data:", "blob:", ...imageHosts.map((host) => `https://${host}`)];
  const connect = ["'self'", ...(apiOrigin ? [apiOrigin] : []), ...(development ? ["ws:"] : [])];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": images,
    "font-src": ["'self'"],
    "connect-src": connect,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    // Ignored by browsers over plain http, so local production runs are unaffected.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}

/** The API origin from NEXT_PUBLIC_API_BASE_URL, or null if unset or invalid. */
export function apiOriginFrom(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
