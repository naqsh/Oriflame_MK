# ADR-003: Admin Authentication

**Status:** Accepted
**Date:** 2026-10-27
**Authors:** Claude Code Agent (OR-044)

## Context

The store has one owner who needs a small admin area: sync status and a manual sync, referral status and click counts, an audit log, and optionally product visibility. The requirements (`docs/SECURITY.md`) are hashed credentials, secure session flags, CSRF protection for state changes, lockout or rate limiting on login, and no open registration. The frontend (Next.js) and the API (FastAPI) may run on different origins. The API is public on the internet, so admin protection must not depend on the frontend.

## Decision

**Password login with opaque, server-side sessions. The browser holds the session only in an HttpOnly cookie on the store's own origin. The Next.js server forwards it to the API as a bearer token.**

- **Accounts:** `admin_users` (id, unique lower-cased email, `password_hash`, `is_active`, `created_at`, `last_login_at`, `failed_attempts`, `locked_until`). RLS is on with no policies. The first admin is created with a CLI command (`create-admin`) that prompts for the password. There is no registration endpoint, and no default or seeded credentials.
- **Hashing:** `hashlib.scrypt` from the standard library (n=2^15, r=8, p=1, 16-byte salt) with a constant-time comparison. It is OWASP-acceptable and adds no dependency. Parameters are stored in the hash string so they can be raised later.
- **Sessions:** `admin_sessions` stores only the SHA-256 of a 32-byte random token, plus `expires_at` (8 hours, absolute) and `revoked_at`. Logout revokes the row. Deactivating an admin invalidates all of their sessions at the next request.
- **API:** `POST /api/v1/admin/login` returns the token and expiry. Every other admin route sits on a router with a router-level `require_admin` dependency that reads `Authorization: Bearer`. A missing, unknown, expired or revoked token, or an inactive user, gets 401. New admin routes inherit the protection.
- **Browser:** the `/admin/login` Server Action calls the API and sets the `admin_session` cookie (HttpOnly, Secure in production, SameSite=Strict, path `/admin`, max-age = session expiry). Admin pages read it on the server and call the API with the bearer token. The token never reaches client JavaScript.
- **CSRF:**
  - The API does not authenticate with cookies, so a cross-site request to it carries no credentials.
  - In the browser, state changes are Server Actions. Next.js rejects a Server Action whose `Origin` does not match the host, and the SameSite=Strict cookie is not sent on cross-site requests.
- **Brute force:**
  - Login is rate limited per client address (`RateLimiter`).
  - Accounts lock for 15 minutes after 5 consecutive failures.
  - Responses are a generic "Invalid email or password" whether the email exists, the password is wrong or the account is locked or inactive.
  - The password is never logged or stored, even when a login fails.
- **No admin yet:** the login page shows the CLI setup instruction.

## Consequences

### Positive
- The API is protected on its own: reaching it directly without a valid token gets 401, whatever the frontend does.
- Sessions can be revoked at once (logout, deactivation), which stateless JWTs cannot.
- No new dependencies and no external identity provider to configure or pay for.

### Negative
- Each admin request does one session lookup. This is negligible for a single owner.
- The Next.js server must forward the client address for per-IP login limits; the API trusts it only from configured proxies (OR-050).

### Neutral
- One role (admin). Roles can be added as a column if a later phase needs them.

## Alternatives Considered

### Alternative 1: JWT
- Stateless, but logout and deactivation cannot take effect before expiry without a denylist (which is a session table again). Rejected.

### Alternative 2: External identity provider (e.g. Supabase Auth, Auth0)
- Offloads password handling, but adds an external dependency, configuration and possibly cost for one user, plus a second trust boundary. Revisit if more admins or MFA are needed.

### Alternative 3: Cookie sent directly from the browser to the API
- Needs a shared parent domain or `SameSite=None` and CORS with credentials, plus a separate CSRF token. Rejected in favour of the bearer token forwarded by the Next.js server.
