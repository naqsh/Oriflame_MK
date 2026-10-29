# Deployment — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

> Hosting target is not yet decided — see Pending Decisions in `docs/adr/README.md`. This document defines the steps any target must satisfy.

---

## Prerequisites

- Production Supabase project (separate from development), reachable from the backend host over IPv4 via the session pooler or over IPv6 via the direct connection
- Deployment environment secrets configured (never committed)
- CI green on the release commit (see `docs/DEPLOYMENT-GATES.md`)

---

## Required Environment Variables

| Variable | Service | Notes |
|---|---|---|
| `POSTGRES_URL` | Backend | Production Supabase project connection string (direct or session pooler, port 5432) — see `docs/DATABASE.md` |
| `APP_ENV` | Backend | `production` |
| `CORS_ORIGINS` | Backend | Deployed frontend origin(s) only. In production startup fails unless every entry is an `https://` origin (no `*`, no path) |
| `TRUSTED_PROXIES` | Backend (optional) | Addresses of the reverse proxies / Next.js server in front of the API. Only their `X-Forwarded-For` is honoured for per-client rate limits; leave empty when the API is reached directly |
| `ORIFLAME_COUNTRY` | Backend | `PK` |
| `ORIFLAME_CONSULTANT_CODE` | Backend | Server-side only |
| `ORIFLAME_REFERRAL_URL` | Backend | Official Oriflame host, validated at startup |
| `ORIFLAME_REFERRAL_METHOD` | Backend | `official_url` or `manual_code` |
| `AVAILABILITY_MAX_AGE_HOURS` | Backend | Optional, default `24` (1 to 720). How long a source's stock check counts as verified; older data is shown as "Availability not confirmed" |
| `CATALOGUE_SOURCE` | Backend | `csv` in production: the owner's own product list (docs/CATALOGUE-CSV.md). `fixture` is development only and refuses to load in production |
| `CATALOGUE_CSV_PATH` | Backend | Required with `CATALOGUE_SOURCE=csv`: path to the CSV on the API server (relative paths are from the repository root). Upload the file with the deploy or to the server; it is git-ignored under `data/` |
| Admin accounts | Backend | No secret variable (ADR-003): create the first admin once with `uv run python -m backend.app.cli create-admin you@example.pk` against the production database |
| `SITE_URL` | Frontend **build** and runtime | The store's public origin, e.g. `https://example.pk` (not secret). Used for canonical URLs, Open Graph, the sitemap and robots.txt. Required: a production build fails without it |
| `CONTACT_EMAIL` | Frontend runtime (optional) | Public contact email shown on `/contact`. Invalid or empty values are not shown |
| `CONTACT_WHATSAPP` | Frontend runtime (optional) | Public WhatsApp number shown on `/contact`, international digits only (leading `+` allowed). Invalid or empty values are not shown |
| `APP_ENV` (frontend) | Frontend runtime | `production` only on the live store. Anything else makes robots.txt disallow everything and the sitemap empty, so staging and fixture data are never indexed |
| API base URL (`NEXT_PUBLIC_API_BASE_URL`) | Frontend **build** | Public backend URL (no secrets). Next.js inlines it at build time, so set it before `npm run build`. Required in production: without it `/status` reports the backend unavailable |

---

## Deploy Steps

The hosting target is not chosen yet ([ADR-004](../docs/adr/ADR-004-deployment-target.md), Proposed). These steps are host-agnostic; `.env.production.example` lists every variable.

1. **Gates:** CI is green on the release commit (`docs/DEPLOYMENT-GATES.md`).
2. **Migrate before traffic switches** (release or pre-deploy step), with the production `POSTGRES_URL`:
   ```bash
   uv run alembic upgrade head
   ```
   If it fails, stop: the deploy must not proceed and the old release keeps serving. Migrations 001 to 007 only add tables, columns and indexes, so the old release keeps working on the new schema.
3. **API:** start one instance with
   ```bash
   uv run uvicorn backend.app.main:create_app --factory --host 0.0.0.0 --port $PORT
   ```
   Set the platform's liveness check to `GET /health` and readiness to `GET /health/ready` (503 until the database is reachable). A missing or invalid production variable makes the process exit at startup with a value-free message, so the platform never routes traffic to it.
4. **Frontend:** with `SITE_URL`, `NEXT_PUBLIC_API_BASE_URL` and `APP_ENV=production` set at build time, run `npm ci && npm run build`, then `npm run start` (Node.js server; routes render at request time). The build fails without `SITE_URL`.
5. **First deploy only:** create the admin (see Admin accounts above).
6. **Smoke check:** the homepage and a product page load; `/robots.txt` allows crawling and points to `/sitemap.xml`; the sitemap lists pages (and no fixture products); "Buy from Oriflame" goes to `pk.oriflame.com`; `/admin` redirects to sign-in and `GET /api/v1/admin/me` returns 401; response headers include CSP and HSTS.

---

## Catalogue Sync

Run the sync as a one-off process with the production environment (it is not part of the web server):

```bash
uv run python -m backend.app.cli sync
```

It prints the run id, status and counts, and exits `0` on success or partial, `1` on failure, `3` if a sync is already running and `4` if products from another source exist. Every run is recorded in `catalogue_sync_runs`. **Today this cannot import anything in production:** the only source is development fixtures, which refuse `APP_ENV=production` (`--fixtures` exits `2`). It becomes useful once ADR-001 accepts a permitted source. Admins can also start a sync from `/admin/sync` (OR-047), which applies the same checks.

---

## Rollback

1. Redeploy the previous API and frontend releases (the platform's "redeploy previous" or the previous image tag). Because migrations only add to the schema, the previous release runs on the current schema; no database change is needed.
2. Downgrade a migration (`uv run alembic downgrade -1`) only when it is documented as reversible and data-safe **and** the previous release cannot run on the new schema. Back up first (Supabase backups or `pg_dump`). Downgrading 006/007 deletes admin accounts, sessions and the audit log.
3. Record the incident per `docs/INCIDENT-RESPONSE.md`.

---

## Updating Referral Configuration

Referral code/URL changes are made in deployment environment settings (`ORIFLAME_REFERRAL_METHOD`, `ORIFLAME_REFERRAL_URL`, `ORIFLAME_CONSULTANT_CODE`), followed by an API restart (settings are read once per process). The new values are validated at startup: a URL that is not https on `pk.oriflame.com` stops the API from starting. Check `/admin/referral` afterwards: it shows the method, status, host and the masked code. The admin area cannot edit them (MVP).

---

*Deployment — Version 0.1.0 — October 2026*
