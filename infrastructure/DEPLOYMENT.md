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
| Admin auth secrets | Backend | Per chosen admin auth (ADR) |
| API base URL | Frontend | Public backend URL (no secrets) |

---

## Deploy Steps

1. Confirm deployment gates pass (`docs/DEPLOYMENT-GATES.md`).
2. Apply migrations to the production Supabase project: `uv run alembic upgrade head` (with production `POSTGRES_URL`). Confirm RLS is enabled on all new tables.
3. Deploy backend; verify health endpoint.
4. Deploy frontend (`npm run build`); verify homepage, a product page, sitemap, and robots.txt.
5. Verify the "Buy from Oriflame" handoff resolves to the configured official destination.
6. Confirm admin routes reject unauthenticated access.

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
