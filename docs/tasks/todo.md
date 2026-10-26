# Active Tasks — Oriflame Pakistan Referral Store

> Write the plan here **before** any implementation. Update as steps complete. Never mark a step done without evidence.

---

## Current Epic

**OR-E1 — MVP 1: Project Scaffold** on branch `epic/E1-project-scaffold` (from `epic/autonomus-implementation`). See `docs/PLAN.md`.

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
- [ ] OR-008 onward: see `docs/jira-tickets-json/OR-E1-mvp1-scaffold.json`

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
| — | — | — |

---

*Last Updated: October 2026*
