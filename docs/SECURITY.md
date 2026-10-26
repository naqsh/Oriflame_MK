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
| Referral handoff | Server-side resolution; HTTPS + host allow-list (prevents open redirect) | Referral tests |
| Admin | AuthN + AuthZ dependency on every admin route | `tests/security/` access tests |
| Input validation | Pydantic (backend), Zod (frontend) | API validation tests |
| Database | Parameterised ORM operations only | Code review + tests |
| Supabase Data API | RLS enabled on every `public` table with no policies; anon/service_role keys unused; `POSTGRES_URL` server-side only | RLS assertion test |
| CORS | Narrow `CORS_ORIGINS` | Integration test |
| Headers | CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors | Header test |
| Rate limits | On search, referral, and admin endpoints where appropriate | Rate-limit test |
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
