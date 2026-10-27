import { describe, expect, it } from "vitest";

import { apiOriginFrom, contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

function directives(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

describe("content security policy", () => {
  const production = directives(
    contentSecurityPolicy({ apiOrigin: "https://api.store.example.pk", imageHosts: [], development: false }),
  );

  it("locks down plugins, framing, forms and base URLs", () => {
    expect(production["object-src"]).toBe("'none'");
    expect(production["frame-ancestors"]).toBe("'none'");
    expect(production["form-action"]).toBe("'self'");
    expect(production["base-uri"]).toBe("'self'");
    expect(production["default-src"]).toBe("'self'");
  });

  it("never allows eval in production, and lets the browser reach only the site and API", () => {
    expect(production["script-src"]).not.toContain("unsafe-eval");
    expect(production["connect-src"]).toBe("'self' https://api.store.example.pk");
    expect(production["img-src"]).toBe("'self' data: blob:");
  });

  it("allows authorised image hosts, and eval and websockets only in development", () => {
    const dev = directives(
      contentSecurityPolicy({ apiOrigin: "http://localhost:8000", imageHosts: ["img.example.com"], development: true }),
    );
    expect(dev["img-src"]).toContain("https://img.example.com");
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toBe("'self' http://localhost:8000 ws:");
  });
});

describe("security headers", () => {
  it("sets the standard hardening headers", () => {
    const headers = Object.fromEntries(
      securityHeaders({ apiOrigin: null, imageHosts: [], development: false }).map((h) => [h.key, h.value]),
    );
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d+/);
  });

  it.each([
    ["https://api.example.pk/base/", "https://api.example.pk"],
    ["http://localhost:8000", "http://localhost:8000"],
    ["", null],
    [undefined, null],
    ["not a url", null],
  ])("apiOriginFrom(%j) = %j", (value, expected) => {
    expect(apiOriginFrom(value)).toBe(expected);
  });
});
