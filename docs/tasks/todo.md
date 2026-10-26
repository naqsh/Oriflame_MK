# Active Tasks — Oriflame Pakistan Referral Store

> Write the plan here **before** any implementation. Update as steps complete. Never mark a step done without evidence.

---

## Current Epic

**OR-E2 — MVP 2: Catalogue Data** on branch `epic/E2-catalogue-data` (from `epic/autonomus-implementation` at `f3b4a5a`). See `docs/PLAN.md`.

### Plan

- [x] OR-010: [ADR-001](../adr/ADR-001-catalogue-data-source.md) written (status **Proposed**) and indexed. Owner confirmed on 2026-10-26: no permitted source yet, so development fixtures only; images omitted (no copying, no hot-linking); no authorised image hosts. Read-only check of pk.oriflame.com (robots.txt, catalogue sitemap, one product page's JSON-LD) recorded as a rejected alternative pending written permission. The Terms and Conditions PDF was not reviewed (it starts a download).
- [x] OR-011: models in `backend/app/models/catalogue.py` (`Product`, `ProductImage`, `Category`, `product_categories`, `CatalogueSyncRun` with the `sync_run_status` enum) and migration `002_catalogue_schema` with RLS on all five tables. `ProductVariant` and `ProductAvailability` are omitted (ADR-001 confirms no source for them; noted in `backend/AGENT.md`). `price_pkr` is nullable with a `> 0` check, and currency is PKR only. Deterministic slug collision strategy in `backend/app/services/slugs.py` (source-id suffix). Evidence: upgrade → `downgrade -1` (tables and enum gone) → upgrade, downgrade base → upgrade, and `alembic check` (no drift) against `postgres:17`. Backend gate: ruff, format, mypy clean; 86 passed, 98.23% coverage, including the new unit tests for slugs and the `db` tests for unique slug/source_id, positive price, PKR only, image cascade with shared categories kept, parent category `SET NULL`, enum values, indexes, RLS, and no tenant/variant tables. **Not run against the Supabase dev project** (blocked on `.env`).
- [ ] OR-012: catalogue repositories with idempotent upserts
- [ ] OR-013: replaceable Oriflame source adapter
- [ ] OR-014: catalogue sync service with run recording and safe retries
- [ ] OR-015: explicitly named development fixtures
- [ ] OR-016: catalogue sync command-line entry point
- [ ] OR-017: documentation sync for catalogue data

---

## OR-E1 record (merged in `b211b58`)

**OR-E1 — MVP 1: Project Scaffold** on branch `epic/E1-project-scaffold` (from `epic/autonomus-implementation`).

### Plan

- [x] OR-001: integration branch `epic/autonomus-implementation` created from `origin/main` and pushed
- [x] OR-001: local branch `epic/E1-project-scaffold` created (the user commits and pushes it by hand)
- [x] OR-001: `.env.example`, `.nvmrc` (Node 24), `pyproject.toml` + `uv.lock` (ruff, mypy strict, pytest)
- [x] OR-002: `backend/app/core/config.py` holds `Settings`, `ReferralConfig`, `ConfigProvider`, `EnvConfigProvider` and `get_config_provider`. The referral allow-list is `pk.oriflame.com` only (owner-confirmed). 28 unit tests are in `backend/tests/unit/test_config.py`.
- [x] OR-003: `create_app()` factory, `/health` + `/health/ready`, CORS limited to `CORS_ORIGINS`, structlog JSON, request-id middleware, generic 500 handler. `db/session.py` has the engine only; OR-004 adds sessions. `core/security.py` is deferred to OR-E6 (admin auth). Tests: 43 pass, 1 real-DB test skipped until `TEST_POSTGRES_URL` exists (OR-007).
- [x] OR-004: `get_session_factory` and `get_db` (closes the session on success and on error). `Base` with a naming convention. `alembic.ini` + `backend/alembic/env.py` (URL from Settings, Supabase schemas excluded, URL-free errors). `001_baseline` enables RLS on `alembic_version`. Tests: session lifecycle and error-message unit tests pass. The migration tests (upgrade, downgrade/upgrade, `alembic check`, RLS) are written but skipped until `TEST_POSTGRES_URL` exists. Verified against local PostgreSQL 17 in OR-007. **Not yet run against the Supabase dev project** (blocked on the `.env` password brackets).
- [x] OR-005: Next.js 16.4.3 App Router in `frontend/` (TS strict + `noUncheckedIndexedAccess`, ESLint, Tailwind 4, shadcn init with no primitives). The layout shell (header/main/footer with disclaimer) and the homepage shell have no product data. Scripts: dev, build, start, lint, typecheck, test, test:e2e. `images.remotePatterns` is empty. Gate: lint, typecheck, test (6 pass) and build all pass. A Vitest guard fails on any `NEXT_PUBLIC_` name except `NEXT_PUBLIC_API_BASE_URL`.
- [x] OR-006: `lib/api/client.ts` (`fetchJson` + Zod, 5 s timeout, typed `ApiError`), `lib/api/schemas/health.ts`, and a `/status` page (noindex) with a request-time `BackendStatus` Server Component. Vitest covers valid, extra-field, missing-field, non-JSON, non-2xx, timeout and network cases, plus the healthy and unavailable UI (17 tests in total). The Playwright smoke test moves to OR-007, which installs browsers and config.
- [x] OR-007 test harnesses. Backend: `conftest.py` with a session-scoped migrated test DB from `TEST_POSTGRES_URL` (fails with a setup message if unset; refuses `POSTGRES_URL` and Supabase hosts), a rolled-back `db_session`, `db_app`, an httpx `async_client`, and `APP_ENV=test`. pytest-cov `fail_under=80` (96.7% without db tests); pytest-socket blocks non-localhost. Frontend: Vitest coverage (75% overall, 90% lib/api + lib/seo; currently 100% of lines), user-event, `fetch` blocked unless stubbed. `playwright.config.ts` starts backend + frontend; the `e2e/smoke.spec.ts` homepage + `/status` healthy tests pass (2). Full run against `postgres:17` in Docker (`oriflame-test-db`, port 54329): 58 passed, coverage 97.7%, including all 6 `db` tests (upgrade, downgrade/upgrade, `alembic check`, RLS, rollback session, readiness against a real DB).
- [x] OR-008: `.github/workflows/ci.yml` runs backend, frontend and e2e jobs on every PR and on pushes to the integration branch. Actions are SHA-pinned; `contents: read`; placeholder config only; `uv sync --locked` / `npm ci` fail on stale lockfiles. Python pinned to 3.14 via `.python-version`. Local evidence: actionlint clean; the CI database steps rehearsed against `postgres:17` (upgrade head on a fresh DB, 58 tests on a separate DB, 97.7% coverage); `pip-audit` and `npm audit --omit=dev` report no vulnerabilities. On GitHub: CI on draft PR naqsh/Oriflame_MK#2 passed at `37c9591` (backend 47 s, frontend 26 s, Playwright 54 s). The deliberate-failure commit `f1e2459` turned CI red (backend failed at Ruff F401, frontend at a Vitest assertion, Playwright skipped). It was reverted in `4c01ecd`, whose tree is identical to `37c9591`.
- [x] OR-009: no version placeholders remain (ENGINEERING-STANDARDS, backend/frontend AGENT.md). README status and Quick Start are verified. The backend and frontend trees match the real layout and say where the referral allow-list lives. PLAN.md marks OR-E1 ✅. ADR-005 (config provider seam) and ADR-006 (scaffold toolchain choices) are written. All internal markdown links resolve (40 files checked).

### Assumptions

- `[tool.uv] package = false` until OR-003 adds the `backend` package.
- The user commits and pushes epic branch work themselves.

### Verification

```bash
uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
```

### Review

_Summary of what changed, evidence (test output / build logs), and follow-ups._

**OR-E1 summary:** backend (typed settings, FastAPI factory, health/readiness, logging, SQLAlchemy + Alembic), frontend (Next.js 16 shell, Zod API client, `/status`), test harnesses and CI. All evidence is from runs made in this epic:

- Backend gate: 58 passed, 97.7% coverage, including 6 `db` tests on `postgres:17`.
- Frontend gate: lint, typecheck, 18 Vitest tests (100% of lines), build.
- Playwright: 2 smoke tests.
- CI on PR naqsh/Oriflame_MK#2: green, and red on the deliberate-failure commit.

**OR-009 clean-checkout check (2026-10-26):** fresh `git clone --branch epic/E1-project-scaffold`; `cp .env.example .env` with `POSTGRES_URL` pointed at a new local database (`tryit` on the `postgres:17` container); `uv sync`; `uv run alembic upgrade head` (ran `001_baseline`); `uv run uvicorn backend.app.main:create_app --factory --reload`; `cd frontend && npm ci && npm run dev`. Results: `/health` returned `{"status":"ok"}`, `/health/ready` returned `{"status":"ready","database":"ok"}`, and `/status` returned HTTP 200 with "Backend service: healthy".

**Not verified in this epic:** migrations against the hosted Supabase dev project, because the local `.env` password is still in `[ ]`.

**Follow-ups:** check the Supabase Postgres major version against the `postgres:17` used in tests/CI (ADR-006). Add Dependabot for the pinned action SHAs.

**OR-006 manual connectivity check (2026-10-26):**

1. Backend: `POSTGRES_URL=postgresql://localhost:5432/app CORS_ORIGINS=http://localhost:3000 uv run uvicorn backend.app.main:create_app --factory --port 8000`. `GET /health` returned `{"status":"ok"}`.
2. Frontend: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build && npx next start -p 3000`. The build shows `◐ /status` (Partial Prerender).
3. Backend up: `GET /status` returned HTTP 200 with "Backend service: healthy". The backend log shows `GET /health 200`, and the browser pane showed the same text.
4. Backend stopped: `GET /status` returned HTTP 200 with "Backend service: unavailable. Please try again shortly." No raw error text was in the page. The server log shows `backend_health_check_failed kind=network`.
5. `<meta name="robots" content="noindex, nofollow">` is present on `/status`.

Found along the way: without `connection()`, `/status` was prerendered at build time and froze the result. A build without `NEXT_PUBLIC_API_BASE_URL` reports `kind=config` in production.

---

## Completed Epics

| Epic | Summary | Completed |
|---|---|---|
| OR-E1 | MVP 1 project scaffold (OR-001 to OR-009), PR naqsh/Oriflame_MK#2, merge commit `b211b58` | 2026-10-26 |

---

*Last Updated: October 2026*
