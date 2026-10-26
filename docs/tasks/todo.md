# Active Tasks — Oriflame Pakistan Referral Store

> Write the plan here **before** any implementation. Update as steps complete. Never mark a step done without evidence.

---

## Current Epic

**OR-E3 — MVP 3: Storefront** on branch `epic/E3-storefront` (from `epic/autonomus-implementation` at `ea3d6ff`). See `docs/PLAN.md`.

### Plan

- [x] OR-018: `GET /api/v1/products` (query model with category including subcategories, price range, 5 sorts, page, and page_size 1 to 100) and `GET /api/v1/products/{slug}` (images, categories, availability, source URL, last sync, 4 related). Router → `ProductService` → `repositories/product_reads.py`. Visible products only; `data_source` / `is_development_data` on every item. Availability comes from a minimal `services/availability.py` (always `not_confirmed`, since no source provides availability); OR-021 completes it. Evidence: backend gate clean; 238 passed with `-W error::DeprecationWarning`, 98.81% coverage. `test_products_api.py` (33 tests) covers pagination totals, page_size over 100 → 422, every sort with unknown prices last, invalid sort → 422, hidden products excluded and 404, unknown slug → safe 404, a page past the end → empty with the total, price filters excluding unknown prices, invalid slugs rejected before the database, unknown parameters → 422, and cyclic category data.
- [x] OR-019: `GET /api/v1/categories` (tree with visible product counts that include subcategories; empty categories at 0) and `GET /api/v1/categories/{slug}` (ancestors from root to parent, children with counts, 404 or 422). `services/categories.py` builds the tree in memory from `repositories/category_reads.py`; `break_cycles` cuts each cycle at its lowest id and logs `category_cycle_detected`. Evidence: backend gate clean; 253 passed with `-W error::DeprecationWarning`, 98.92% coverage. Tests cover nesting, counts excluding hidden products and counting a product once, counts matching `/products?category=`, ancestor paths, 404 and 422, an empty catalogue, cyclic parents in the database (every category appears once), and unit tests for `break_cycles`.
- [x] OR-020: migration `004_product_search` (generated `search_vector` with name weight A and description weight B, `english` configuration, GIN index; `pg_trgm` in the `extensions` schema with a trigram GIN index on `name`) and `GET /api/v1/search`. Full-text with `websearch_to_tsquery`, an exact name match first, then `ts_rank_cd`; fuzzy `word_similarity` fallback only when there are no full-text hits. Rate limiting deferred to OR-E6 (documented). Evidence: migration upgrade, `downgrade -1` and upgrade, `alembic check` with no drift, and `pg_trgm` confirmed in `extensions` on `postgres:17`. Backend gate clean; 281 passed with `-W error::DeprecationWarning`, 98.95% coverage. `test_search_api.py` (28 tests) covers exact-match-first ranking, name above description, partial and stemmed queries, misspellings, SQL and tsquery special characters, Urdu, hidden products never appearing, pagination and shape, trimming, and the q bounds. **Not verified on Supabase:** the extension and schema there, until the `.env` is fixed.
- [x] OR-021: `services/availability.py` with `describe(snapshot, context, policy)`. Statuses are verified in stock or out of stock (only fresh, timezone-aware, not future-dated snapshots) or `not_confirmed` (a context label for list or detail). Labels say "when last checked" and never "now" or "live"; quantities are never returned. New setting `AVAILABILITY_MAX_AGE_HOURS` (default 24, 1 to 720) in Settings, `.env.example`, ENGINEERING-STANDARDS and DEPLOYMENT, passed to `ProductService` as an `AvailabilityPolicy`. `snapshot_for` returns `None` until a source provides availability (none does, per ADR-001), so every product stays `not_confirmed`. No `/availability/{slug}` endpoint: the detail payload carries it. Evidence: backend gate clean; 298 passed with `-W error::DeprecationWarning`, 98.97% coverage. `test_availability.py` (17 tests) covers no data, fresh in and out of stock with `checked_at`, stale, future and naive snapshots, the window edge, the policy window, quantities never returned, labels free of real-time wording, and the setting's bounds and wiring.
- [x] OR-022: Zod catalogue schemas and API functions (`lib/api/schemas/catalogue.ts`, `lib/api/catalogue.ts`). Product components `Price`, `AvailabilityBadge`, `ProductImage`, `ProductCard`, `ProductGrid`; layout `DevDataBanner`, `CategoryNav`; `SearchBox` in the header. `lib/images.ts` is the single image allow-list, also feeding `next.config.ts` (`remotePatterns` stays empty per ADR-001; `/dev-fixture/` placeholders render from the local path). All Server Components. Evidence: frontend gate clean (lint, typecheck, 81 Vitest tests with 97.8% lines overall and `lib/api` 98.3%, build). Tests cover PKR formatting and the null case, badge labels per status, the card's link name and href, unauthorised-host and missing images falling back to the placeholder, long names, the dev banner only for fixtures, Zod rejecting malformed payloads, API query mapping and 404 → null, and the search form. Manual check: backend with the fixture sync plus `next dev`; the header shows Sample Category A and B and the search box at desktop and 375 px, with no console errors.
- [x] OR-023: homepage with a static hero (independent-storefront wording, one `h1`) and "How it works" (3 steps, link to `/referral`, which OR-E4 builds). `HomeCatalogue` is streamed per request: featured products, or the newest 8 if none are featured, plus the dev banner and category entry points, with empty and unavailable states. Backend: new `featured` filter on `GET /api/v1/products`. Rendering decision (request-time now, ISR with OR-052) documented in `frontend/AGENT.md`. Evidence: frontend gate clean (89 Vitest tests, 97.6% lines, build); Playwright 2/2; backend product API tests 34/34 including the featured filter. Manual production check (`next build` with `NEXT_PUBLIC_API_BASE_URL`, `next start`, backend with fixtures and 4 products featured): desktop and 375 px render the dev banner, "Featured products" (4), "Shop by category" and "How it works", with one `h1`, header/main/footer landmarks, no horizontal scroll and no new console errors.
  - **Performance (recorded for the Review):** TTFB 20 to 25 ms; full HTML including the streamed catalogue in 107 to 149 ms; CLS 0; the LCP element is the static `h1`. An absolute LCP time could not be measured: the in-app browser pane was hidden, so the first paint only happened when a screenshot forced it (reported as 7 s and 22 s, which are artifacts). Run Lighthouse in a visible browser before launch (OR-E5/OR-E6).
- [ ] OR-024: product listing and category pages
- [ ] OR-025: product detail page
- [ ] OR-026: search results page
- [ ] OR-027: local shopping list
- [ ] OR-028: documentation sync for storefront

---

## OR-E2 record (merged in PR naqsh/Oriflame_MK#3, `46f234c`)


### Plan

- [x] OR-010: [ADR-001](../adr/ADR-001-catalogue-data-source.md) written (status **Proposed**) and indexed. Owner confirmed on 2026-10-26: no permitted source yet, so development fixtures only; images omitted (no copying, no hot-linking); no authorised image hosts. Read-only check of pk.oriflame.com (robots.txt, catalogue sitemap, one product page's JSON-LD) recorded as a rejected alternative pending written permission. The Terms and Conditions PDF was not reviewed (it starts a download).
- [x] OR-011: models in `backend/app/models/catalogue.py` (`Product`, `ProductImage`, `Category`, `product_categories`, `CatalogueSyncRun` with the `sync_run_status` enum) and migration `002_catalogue_schema` with RLS on all five tables. `ProductVariant` and `ProductAvailability` are omitted (ADR-001 confirms no source for them; noted in `backend/AGENT.md`). `price_pkr` is nullable with a `> 0` check, and currency is PKR only. Deterministic slug collision strategy in `backend/app/services/slugs.py` (source-id suffix). Evidence: upgrade → `downgrade -1` (tables and enum gone) → upgrade, downgrade base → upgrade, and `alembic check` (no drift) against `postgres:17`. Backend gate: ruff, format, mypy clean; 86 passed, 98.23% coverage, including the new unit tests for slugs and the `db` tests for unique slug/source_id, positive price, PKR only, image cascade with shared categories kept, parent category `SET NULL`, enum values, indexes, RLS, and no tenant/variant tables. **Not run against the Supabase dev project** (blocked on `.env`).
- [x] OR-012: `backend/app/repositories/{products,categories,sync_runs,outcomes,slugs}.py` and validated input records in `backend/app/schemas/catalogue.py`. Product upsert uses `INSERT ... ON CONFLICT (source_id) DO UPDATE ... WHERE IS DISTINCT FROM` and returns created/updated/unchanged; `last_synced_at` always refreshes, `updated_at` only on a real change (fields, images or links). Images replaced in the same savepoint without duplicates; category links reconciled; unknown categories reported, not created; category parents linked in a second pass (no FK violation). Admin flags and slugs survive syncs. Concurrent syncs refused by a PostgreSQL advisory lock (`SyncAlreadyRunningError`). A record missing `source_id` fails Pydantic validation and never reaches the database (counting it is OR-014). Evidence: backend gate clean (ruff, format, mypy); 124 passed with `-W error::DeprecationWarning`, 98.77% coverage. New tests cover all four testing criteria, including a hostile-name test proving values are bound parameters, plus savepoint rollback, stale-run recovery and lock release on error.
- [x] OR-013: `CatalogueSource` Protocol, `SourceError` family and `InvalidRecord` in `integrations/oriflame/client.py`; `FixtureCatalogueSource` (the only adapter, per ADR-001; refuses `APP_ENV=production`; whole file checked before any record) in `fixtures.py`; `FeedHttpClient` in `http.py` for a future permitted feed, with no endpoint configured. `CATALOGUE_SOURCE=fixture` added to Settings, `.env.example`, README, try-it-locally, ENGINEERING-STANDARDS and DEPLOYMENT; unknown values fail at startup. httpx moved from dev to runtime dependencies (same version). Evidence: backend gate clean; 162 passed with `-W error::DeprecationWarning`, 98.95% coverage. Mocked-HTTP tests (`httpx.MockTransport`, no network) cover parse success, timeout, connection error, 429 with and without Retry-After and over budget, 5xx, 401/403, malformed JSON, redirects, query strings kept out of errors, and pagination with a partial-page failure. A guard test fails if integration code mentions an Oriflame host.
- [x] OR-014: `CatalogueSyncService` in `backend/app/integrations/oriflame/catalogue.py`. It takes the advisory lock, fails orphaned `running` rows (safe because the lock is held, so no timeout or clock comparison is needed), records the run, upserts categories then products in committed batches of 100, and finishes as success, partial or failed per the rules in `backend/AGENT.md`. Products no longer listed are hidden (new `hide_products_missing_from`, which refuses an empty list). structlog events `catalogue_sync_started` / `finished` / `failed`. Evidence: backend gate clean; 180 passed with `-W error::DeprecationWarning`, 99.05% coverage. `test_catalogue_sync.py` covers all three testing criteria (two fixture runs give identical product/category/image counts with the second all unchanged; a mid-run failure is recorded and a rerun completes without duplicates; a concurrent run is refused with no run row) plus every edge case. Writing those tests caught a real bug (a database error while hiding left the run `running`), now fixed. **Known limitation:** a sync never re-shows a hidden product, because there is no column to tell a sync hide from an admin hide; revisit in OR-E6.
- [x] OR-015: `backend/fixtures/dev_catalogue_sample.json` (fixture notice; 3 placeholder categories and 12 `Sample Product NN` / `DEV-NNNN` products; placeholder SVG served from `frontend/public/dev-fixture/`). Migration `003_product_source` adds `products.source`; fixture rows are `dev_fixture`. `FixtureCatalogueSource` is now strict (one invalid record rejects the file) and refuses files without the notice. `CatalogueSyncService.run(..., allow_mixed_sources=False)` refuses to mix sources (`MixedSourcesError`, no run recorded), and hiding is limited to the syncing source. Evidence: migration upgrade, `downgrade -1`, upgrade and `alembic check` against `postgres:17`; backend gate clean; 193 passed with `-W error::DeprecationWarning`, 99.08% coverage. Tests cover production refusal, the `dev_fixture` source value, a grep-style guard on the fixture, the shipped fixture syncing twice (12 created, then 12 unchanged), mixing refused both ways, and forced mixing that leaves the other source visible.
- [x] OR-016: `backend/app/cli.py` (`uv run python -m backend.app.cli sync [--fixtures] [--force-dev]`, argparse, no new dependency). It prints the run id, status and counts. Exit codes: 0 success or partial, 1 failed, 2 usage or config, 3 already running, 4 mixed sources. `--fixtures` is refused in production and `--force-dev` outside development. Database errors print the URL-free `describe_connection_error` message with no traceback. Documented in try-it-locally (section 4) and DEPLOYMENT (Catalogue Sync). Evidence: backend gate clean; 205 passed with `-W error::DeprecationWarning`, 98.73% coverage. `test_cli.py` covers success with counts, the failure exit, `--fixtures` in production, `--force-dev` outside development, already running, mixed sources, and bad and unreachable databases with no credential in the output. Manual run against `postgres:17`: `sync --fixtures` gave run 1 success with created=12, then `sync` gave run 2 with unchanged=12.
- [x] OR-017: CATALOGUE-DATA "Current State" (fixtures only, file name, manual cadence, removal policy, tables). Learning note `docs/learning/2026-10-idempotent-catalogue-upserts.md` and `docs/example-code/upsert-pattern.py` (ruff, mypy and import clean), both linked from `backend/AGENT.md`. README status, AGENT.md milestone table and PLAN.md MVP 2 updated. The data model table matches migrations 002 and 003, with the omitted variant and availability tables noted. Internal markdown links checked.

### Review

**OR-E2 summary:** catalogue schema (migrations 002 and 003, row-level security on every table), idempotent repositories, a replaceable source interface with a strict development-fixture adapter and an HTTP feed client for a future permitted source, the sync service with run records, and the `sync` CLI. ADR-001 stays **Proposed**: development fixtures only, no images from Oriflame, and nothing read from Oriflame's website.

Evidence (local, `postgres:17` in Docker):
- Backend gate: ruff, format and mypy clean; 205 tests passed with `-W error::DeprecationWarning`, 98.73% coverage, including every `db` test.
- Migrations: upgrade, `downgrade -1`, downgrade to `001_baseline`, upgrade and `alembic check` (no drift).
- CLI: `sync --fixtures` gave success with created=12, then `sync` gave unchanged=12.

**Not verified in this epic:** migrations against the hosted Supabase dev project (the local `.env` still needs the password fix), and a real Oriflame source (none permitted).

**Follow-ups:** an admin control to re-show hidden products (OR-E6); accept ADR-001 once written permission or an official feed exists; the Supabase Postgres major version check (ADR-006).

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
| OR-E2 | MVP 2 catalogue data (OR-010 to OR-017), development fixtures only (ADR-001 Proposed), PR naqsh/Oriflame_MK#3, merge commit `46f234c` | 2026-10-26 |

---

*Last Updated: October 2026*
