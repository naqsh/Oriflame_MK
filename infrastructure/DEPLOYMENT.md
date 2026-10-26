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
| `CORS_ORIGINS` | Backend | Deployed frontend origin(s) only |
| `ORIFLAME_COUNTRY` | Backend | `PK` |
| `ORIFLAME_CONSULTANT_CODE` | Backend | Server-side only |
| `ORIFLAME_REFERRAL_URL` | Backend | Official Oriflame host, validated at startup |
| `ORIFLAME_REFERRAL_METHOD` | Backend | `official_url` or `manual_code` |
| `AVAILABILITY_MAX_AGE_HOURS` | Backend | Optional, default `24` (1 to 720). How long a source's stock check counts as verified; older data is shown as "Availability not confirmed" |
| `CATALOGUE_SOURCE` | Backend | Only `fixture` exists until ADR-001 accepts a permitted source, and fixtures refuse to load in production, so a production catalogue sync cannot run yet |
| Admin auth secrets | Backend | Per chosen admin auth (ADR) |
| API base URL (`NEXT_PUBLIC_API_BASE_URL`) | Frontend **build** | Public backend URL (no secrets). Next.js inlines it at build time, so set it before `npm run build`. Required in production: without it `/status` reports the backend unavailable |

---

## Deploy Steps

1. Confirm deployment gates pass (`docs/DEPLOYMENT-GATES.md`).
2. Apply migrations to the production Supabase project: `uv run alembic upgrade head` (with production `POSTGRES_URL`). Confirm RLS is enabled on all new tables.
3. Deploy backend; verify health endpoint.
4. Deploy frontend (`npm run build`); verify homepage, a product page, sitemap, and robots.txt.
5. Verify the "Buy from Oriflame" handoff resolves to the configured official destination.
6. Confirm admin routes reject unauthenticated access.

---

## Catalogue Sync

Run the sync as a one-off process with the production environment (it is not part of the web server):

```bash
uv run python -m backend.app.cli sync
```

It prints the run id, status and counts, and exits `0` on success or partial, `1` on failure, `3` if a sync is already running and `4` if products from another source exist. Every run is recorded in `catalogue_sync_runs`. **Today this cannot import anything in production:** the only source is development fixtures, which refuse `APP_ENV=production` (`--fixtures` exits `2`). It becomes useful once ADR-001 accepts a permitted source. An admin trigger follows in OR-E6.

---

## Rollback

1. Redeploy the previous backend/frontend release.
2. Only downgrade migrations when the migration is documented as reversible and data-safe.
3. Record the incident per `docs/INCIDENT-RESPONSE.md`.

---

## Updating Referral Configuration

Referral code/URL changes are made in deployment environment settings, followed by a redeploy/restart. The admin area shows configuration status only (MVP).

---

*Deployment — Version 0.1.0 — October 2026*
