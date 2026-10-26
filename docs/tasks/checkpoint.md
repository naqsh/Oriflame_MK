# Session Checkpoint: OR-E2 Merged, Ready for OR-E3

**Date:** October 26, 2026
**Repo:** `naqsh/Oriflame_MK` (**public**), local path `D:\Projects\OriflameMK` (Windows)
**Integration branch:** `epic/autonomus-implementation` at merge commit `46f234c` (PR #3)
**Status:** MVP 1 (OR-001 to OR-009) and MVP 2 (OR-010 to OR-017) complete and merged. OR-E3 not started.

---

## Project

- **What it is:** a single-vendor referral storefront for Oriflame Pakistan. Visitors browse and shortlist products, then go to the official Oriflame site through the owner's referral link.
- **Out of scope:** multi-tenancy, billing and on-site checkout.
- **Never:** imply official Oriflame affiliation, or invent products, prices, stock or attribution.
- **Read first, in order:** `CLAUDE.md` → this file → `docs/tasks/lessons.md` → `AGENT.md` → `docs/TOKEN-EFFICIENCY.md` → `docs/PLAN.md` → `docs/EXECUTION-RULES.md`.

## Current state

- **MVP 2 is merged.** PR #3 merged `epic/E2-catalogue-data` into `epic/autonomus-implementation` as merge commit `46f234c`.
- **Local checkout:** on `epic/autonomus-implementation`. The local E2 branch is deleted; the remote `origin/epic/E2-catalogue-data` is kept.
- **`main`** holds only the docs and `LICENSE`. Epic work merges into the integration branch, never into `main`.
- **This file** is kept on purpose as the handoff between sessions (the owner asked for it), although the docs rules say to delete the checkpoint after a merge. Replace it at the next handoff.

## Catalogue data (MVP 2)

- **ADR-001 is Proposed:** no permitted Oriflame data source exists. Only **development fixtures** are used; product images from Oriflame are omitted; nothing reads Oriflame's website (a guard test enforces this).
- **Fixture:** `backend/fixtures/dev_catalogue_sample.json` (12 `Sample Product NN` products, 3 categories). Load it with `uv run python -m backend.app.cli sync --fixtures`. Rows get `products.source = 'dev_fixture'`, so OR-E3 can show a "Development data" banner.
- **Schema:** migrations `002_catalogue_schema` and `003_product_source`; tables `products`, `product_images`, `categories`, `product_categories`, `catalogue_sync_runs`. No variant or availability tables, so availability is always "not confirmed".
- **Sync:** `CatalogueSyncService` (idempotent upserts, run records, one sync at a time, hide-not-delete, no mixing of sources). Rules are in `backend/AGENT.md`; the pattern is in `docs/learning/2026-10-idempotent-catalogue-upserts.md`.
- **Known limitation:** a sync never re-shows a hidden product. Needs an admin control (OR-E6).

## Stack and versions

Full pins are in `docs/ENGINEERING-STANDARDS.md`.

- **Backend:** Python 3.14 (`.python-version`; `>=3.12` supported), uv, FastAPI 0.162, Pydantic 2.14, SQLAlchemy 2.1, Alembic 1.20, psycopg 3.3, structlog 26.1, httpx 0.28 (runtime since OR-013).
- **Frontend:** Next.js 16.4.3 (App Router, `cacheComponents`), React 19.3, TypeScript 5.9 strict, Tailwind 4, Zod 4.6, Node 24.
- **Database:** Supabase PostgreSQL through `POSTGRES_URL` (port 5432 only). Row-level security with no policies on every `public` table.
- **Tests:** backend 205 tests (98.7% coverage, `db` tests need `TEST_POSTGRES_URL`); frontend 18 Vitest and 2 Playwright tests. Network blocked in all suites.
- **CI:** `.github/workflows/ci.yml` (backend, frontend, e2e), SHA-pinned actions, no secrets.

## Rules

- **Secrets:** the repo is public. Never commit `.env` or print its values. Scan staged files for secrets before every commit.
- **Branching:** from `epic/autonomus-implementation`, create `epic/E{n}-{short}`; PR back with a **merge commit**; after merge delete the local epic branch, keep the remote.
- **Before marking work done:** backend `uv run ruff check backend && uv run ruff format backend && uv run python -m mypy backend && uv run pytest` (also `-W error::DeprecationWarning`); frontend `npm run lint && npm run typecheck && npm run test && npm run build`.
- **Tickets:** `docs/jira-tickets-json/OR-E{1..6}-*.json`; plan and evidence in `docs/tasks/todo.md`; mistakes in `lessons.md`.
- **Commits:** end with the `Co-Authored-By` line your environment provides.
- **Asking first:** the owner normally asks for each commit, push and PR. For OR-015 to OR-017 and PR #3 they authorised doing it all, including the merge, without asking. That authorisation does not carry over to OR-E3.

## Windows quirks

Details in `docs/tasks/lessons.md`.

- Run `uv run python -m mypy backend` and `uv run python -m pip_audit --skip-editable` (Application Control blocks the `.exe` launchers).
- Stopping `uvicorn --reload` can leave a worker on port 8000; check and stop it.
- No plain `python`; use `uv run python`. Ticket JSON needs `json.loads(..., strict=False)`.
- `NEXT_PUBLIC_API_BASE_URL` is baked in at build time.
- Test database: Docker container `oriflame-test-db` (postgres:17) on port 54329, `TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:54329/postgres`.

## Open items

1. **Owner's `.env`:** remove the `[ ]` around the password in `POSTGRES_URL`, delete the stray `POSTGRES_PASSWORD` line, add `TEST_POSTGRES_URL`. Then run `uv run alembic upgrade head` against the Supabase dev project (never tested there; now three migrations).
2. **Postgres version:** the next agent checks the Supabase project's major version against `postgres:17` (ADR-006) once the `.env` works.
3. **ADR-001:** stays Proposed until the owner has written permission from Oriflame or an official feed.
4. **Decisions still needed from the owner:** ADR-002 referral method (OR-029), ADR-003 admin auth (OR-044), ADR-004 hosting (OR-052).
5. **Optional:** Dependabot for the pinned action SHAs.

## Next

Start **OR-E3 (MVP 3: Storefront)** on a new `epic/E3-storefront` branch from the updated integration branch, beginning with **OR-018** (products API with filter, sort and pagination). Ask the owner before starting.

---

*Checkpoint written October 26, 2026*
