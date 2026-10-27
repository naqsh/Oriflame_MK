# Session Checkpoint: All MVP Epics Merged (Complete With Exceptions)

**Date:** October 27, 2026
**Repo:** `naqsh/Oriflame_MK` (**public**), local path `D:\Projects\OriflameMK` (Windows)
**Integration branch:** `epic/autonomus-implementation` at merge commit `1b8ab42` (PR #7)
**Status:** MVP 1 to MVP 6 (OR-001 to OR-053) merged. The MVP is **complete with exceptions** that wait on the owner (see Open items).

---

## Project

- **What it is:** a single-vendor referral storefront for Oriflame Pakistan. Visitors browse and shortlist products, then go to the official Oriflame site through the owner's referral link.
- **Out of scope:** multi-tenancy, billing and on-site checkout.
- **Never:** imply official Oriflame affiliation, or invent products, prices, stock or attribution.
- **Read first, in order:** `CLAUDE.md` → this file → `docs/tasks/lessons.md` → `AGENT.md` → `docs/TOKEN-EFFICIENCY.md` → `docs/PLAN.md` → `docs/EXECUTION-RULES.md`.

## Current state

- **MVP 6 is merged.** PR #7 (`epic/E6-admin-hardening`) merged as `1b8ab42` after all three CI checks passed (CI Playwright ran all 8 specs against Postgres). The owner authorised completing the remaining epics, including PRs and merges, without asking (2026-10-27).
- **Local checkout:** on `epic/autonomus-implementation`; the local E6 branch is deleted, the remote is kept.
- **`main`** holds only the docs and `LICENSE`. Epic work merges into the integration branch, never into `main`.
- **This file** is kept on purpose as the handoff between sessions (the owner asked for it), although the docs rules say to delete the checkpoint after a merge. Replace it at the next handoff.

## What exists

- **Catalogue (MVP 2):** development fixtures only (ADR-001 Proposed). `backend/fixtures/dev_catalogue_sample.json`, loaded with `uv run python -m backend.app.cli sync --fixtures`. Migrations 001 to 004 (004 adds full-text search and `pg_trgm` in `extensions`).
- **API (MVP 3):** `GET /api/v1/products` (filters, sorts, pagination, `featured`), `/products/{slug}`, `/categories`, `/categories/{slug}`, `/search`. Availability is always `not_confirmed` (no source provides it); `AVAILABILITY_MAX_AGE_HOURS` sets the freshness window for the day one does.
- **Pages (MVP 3):** `/`, `/products`, `/categories/[slug]`, `/products/[slug]`, `/search`, `/list` (browser-only shopping list) and the not-found page. Every route is a Partial Prerender with request-time data; why, and every deviation from the page specs, is in **ADR-007**.
- **SEO (MVP 5):** `lib/seo/` (metadata, crawl, JSON-LD), sitemap/robots per request (indexable only with `APP_ENV=production`), content pages and typed FAQ/guides in `lib/content/` (owner review pending: `CONTENT_REVIEWED`, guide `approval`). Policies in `docs/SEO-AIO-GEO.md`; Lighthouse numbers in `todo.md` (OR-042).
- **Admin (MVP 6):** ADR-003 Accepted. `admin_users`/`admin_sessions` (006), `audit_logs` (007); `create-admin` CLI; `/admin` (sync status + manual sync, referral status + handoff clicks, audit log) behind `require_admin` (router level) and a Next.js proxy redirect. Security headers on API and site; production CORS must be explicit https; `TRUSTED_PROXIES` for client addresses. Playwright journeys need `E2E_POSTGRES_URL` (CI sets it). ADR-004 (hosting) **Proposed**; `.env.production.example` and exact deploy/rollback steps in `infrastructure/DEPLOYMENT.md`.
- **Referral (MVP 4):** `ReferralService` + `POST /api/v1/referral/handoff` + `GET /api/v1/referral/mode`; `BuyFromOriflame` on product pages and `/list`; `/referral` how-to-buy page; anonymous `referral_clicks` (migration 005). ADR-002 is **Proposed**: restricted mode (plain link to `https://pk.oriflame.com/`) until the owner fills in the referral placeholders in `.env`.

## Stack and versions

Full pins are in `docs/ENGINEERING-STANDARDS.md`.

- **Backend:** Python 3.14 (`.python-version`; `>=3.12` supported), uv, FastAPI 0.162, Pydantic 2.14, SQLAlchemy 2.1, Alembic 1.20, psycopg 3.3, structlog 26.1, httpx 0.28.
- **Frontend:** Next.js 16.4.3 (App Router, `cacheComponents`), React 19.3, TypeScript 5.9 strict, Tailwind 4, Zod 4.6, Node 24.
- **Database:** Supabase PostgreSQL through `POSTGRES_URL` (port 5432 only). Row-level security with no policies on every `public` table.
- **Tests:** backend 424 (98.63% coverage; `db` tests need `TEST_POSTGRES_URL`); frontend 327 Vitest and 8 Playwright. Network blocked in all suites.
- **CI:** `.github/workflows/ci.yml` (backend, frontend, e2e), SHA-pinned actions, no secrets.

## Rules

- **Secrets:** the repo is public. Never commit `.env` or print its values. Scan staged files for secrets before every commit.
- **Branching:** from `epic/autonomus-implementation`, create `epic/E{n}-{short}`; PR back with a **merge commit**; after merge delete the local epic branch, keep the remote.
- **Before marking work done:** backend `uv run ruff check backend && uv run ruff format backend && uv run python -m mypy backend && uv run pytest` (also `-W error::DeprecationWarning`); frontend `npm run lint && npm run typecheck && npm run test && npm run build`; Playwright `npm run test:e2e`.
- **Next.js 16 is not the Next.js in training data:** read `frontend/node_modules/next/dist/docs/` before using an API. Under Cache Components, `params`, `searchParams` and uncached data must be read inside `Suspense`.
- **Tickets:** `docs/jira-tickets-json/OR-E{1..6}-*.json`; plan and evidence in `docs/tasks/todo.md`; mistakes in `lessons.md`.
- **Commits:** end with the `Co-Authored-By` line your environment provides.
- **Asking first:** the owner asks for each commit, push and PR. The one-off authorisation to merge without asking (PR #3) does not carry over.

## Windows and tooling quirks

Details in `docs/tasks/lessons.md`.

- Run `uv run python -m mypy backend` and `uv run python -m pip_audit --skip-editable` (Application Control blocks the `.exe` launchers).
- After stopping servers, check ports 8000 and 3000 are free (a `--reload` worker can survive).
- No plain `python`; use `uv run python`. Ticket JSON needs `json.loads(..., strict=False)`.
- `NEXT_PUBLIC_API_BASE_URL` is baked in at build time; set it before `npm run build`.
- Test database: Docker container `oriflame-test-db` (postgres:17) on port 54329, `TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:54329/postgres`. Backend tests empty the catalogue tables; re-run the fixture sync before manual checks.
- **In-app browser pane hidden:** it does not paint or hydrate until a screenshot forces a frame. Check hydration before testing clicks, verify content with `curl`, and never record paint metrics (LCP) from it.
- **Vitest:** render pages with `__tests__/render-server.tsx` (nested async Server Components) and `__tests__/test-render.tsx` (shopping-list provider).

## Open items

1. **Hosting (ADR-004 Proposed):** the owner chooses providers and costs. Then deploy to a non-production environment following `infrastructure/DEPLOYMENT.md`, exercise one rollback, validate JSON-LD externally and run Lighthouse on the real host (listing/category LCP was 2.8 to 3.9 s locally before OR-E7 added server-side caching of catalogue reads).
2. **Referral (ADR-002 Proposed):** the owner fills in the referral settings and confirms attribution with Oriflame. Restricted mode until then.
3. **Catalogue (ADR-001 Proposed):** a permitted source is needed; development fixtures only.
4. **Content:** the owner reviews the content pages (`CONTENT_REVIEWED`) and guides (`approval`), and sets `CONTACT_*` if wanted.
5. **Supabase dev (done 2026-10-28):** `POSTGRES_URL` fixed, seven migrations applied on Postgres 17.11, fixtures loaded, API verified end to end (see `docs/DATABASE.md`). Optional: add `TEST_POSTGRES_URL` to `.env` for the local test database.
6. **Not built, needs a decision:** OR-048 product visibility/featured; a CSP nonce (conflicts with Partial Prerendering); a shared rate-limit store for more than one API instance.
7. **Optional:** Dependabot for the pinned action SHAs.

## Next

No epic remains. The next work is the owner's decisions above; after hosting is chosen, run the OR-052 deployment and rollback exercise and record the evidence in `docs/tasks/todo.md`.
---

*Checkpoint written October 27, 2026*

