# Security — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Why Security Matters Here

The storefront holds the owner's referral/consultant configuration, an admin area, and data imported from an external source. The main risks are leaked configuration, unprotected admin routes, open redirects via the referral handoff, injection through query parameters, and misleading content. No payment or delivery data is collected — checkout happens on Oriflame.

---

## Security Principles

### 1. Zero-Trust Input
All request input (query, path, body) and all imported catalogue data is validated with Pydantic/Zod before use.

### 2. Secrets Stay Server-Side
Consultant code, database credentials, and admin secrets live in server environment settings only. Never use `NEXT_PUBLIC_` for private values.

### 3. Least Privilege
Admin endpoints require authentication and authorisation. The application database user has only the privileges it needs.

### 4. Fail Secure
Missing or invalid referral configuration disables the handoff with a safe message — it never falls back to a guessed URL.

### 5. Audit Meaningful Actions
Admin actions (manual sync, visibility/featured changes) are written to `audit_logs`.

---

## Controls Matrix

| Area | Control | Test Coverage |
|---|---|---|
| Configuration | Pydantic Settings validation; `.env` never committed | Config tests |
| Referral handoff | Server-side resolution; HTTPS + exact host allow-list, no credentials, fragment or non-default port, re-checked on every resolve; the request body cannot carry a destination (`extra="forbid"`); rate limited; clicks stored without personal data | `test_referral.py`, `test_referral_handoff_api.py`, `test_referral_clicks.py`; frontend source scan in `referral.test.tsx` |
| Admin | AuthN + AuthZ dependency on every admin route | `tests/security/` access tests |
| Input validation | Pydantic (backend), Zod (frontend) | API validation tests |
| Database | Parameterised ORM operations only | Code review + tests |
| Supabase Data API | RLS enabled on every `public` table with no policies; anon/service_role keys unused; `POSTGRES_URL` server-side only | RLS assertion test |
| CORS | Narrow `CORS_ORIGINS`; production refuses to start unless every origin is explicit `https` (no `*`, no path) | `test_headers_cors.py`, `test_config.py` |
| Headers | API: `default-src 'none'`, nosniff, DENY, no-referrer, Permissions-Policy, HSTS in production (`core/security_headers.py`). Site: CSP (`lib/security-headers.ts`), nosniff, DENY, strict-origin-when-cross-origin, Permissions-Policy, HSTS. **Known limitation:** the site CSP keeps `script-src 'unsafe-inline'` because Next.js streams inline bootstrap scripts and a per-request nonce would disable the prerendered shells; everything else is locked down (no eval in production, `object-src 'none'`, `frame-ancestors 'none'`, `form-action`/`base-uri 'self'`, connect only to the site and API) | `test_headers_cors.py`, `security-headers.test.ts`, Playwright with CSP on |
| Rate limits | In-memory, per process, per client: login 10/min plus account lockout, search 60/min, handoff 30/min. The client address is the direct peer unless it is a `TRUSTED_PROXIES` entry, so `X-Forwarded-For` cannot be spoofed. Multi-instance hosting would need a shared store (ask before adding Redis) | `test_rate_limit.py`, API tests |
| Logging | Structured logs; secrets and consultant code never logged | Log redaction test |
| Outbound calls | Explicit timeouts; only the permitted catalogue source | Integration tests (mocked) |
| Output | React escaping; no `dangerouslySetInnerHTML` for imported descriptions unless sanitised | Component test |
| Privacy | No card or address collection; minimal personal data | Review checklist |

---

## Referral Open-Redirect Prevention

- The frontend never accepts a destination URL from the client for the handoff.
- `ReferralService` returns only the configured URL after validating scheme (`https`) and host against the allow-list.

---

## Admin Authentication

Mechanism is a pending decision (`docs/adr/README.md`). Whatever is chosen must provide: hashed credentials (if password-based), secure session/cookie flags, CSRF protection for state-changing requests, and lockout or rate limiting on login.

---

## Data Classification

| Data | Classification | Storage |
|---|---|---|
| Catalogue data | Public (source-licensed) | Supabase PostgreSQL (RLS on, Data API blocked) |
| Consultant code / referral URL | Internal | Environment settings |
| Admin credentials | Confidential | Hashed in DB or external IdP |
| Referral click events | Internal, no personal data | Supabase PostgreSQL (RLS on, Data API blocked) |
| Shopping list | Visitor-local | Browser storage only |

---

## Incident Response

See `docs/INCIDENT-RESPONSE.md`.

---

*Security — Version 0.1.0 — October 2026*
