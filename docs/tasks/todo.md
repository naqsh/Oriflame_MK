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
- [x] OR-004: `get_session_factory` and `get_db` (closes the session on success and on error). `Base` with a naming convention. `alembic.ini` + `backend/alembic/env.py` (URL from Settings, Supabase schemas excluded, URL-free errors). `001_baseline` enables RLS on `alembic_version`. Tests: session lifecycle and error-message unit tests pass. The migration tests (upgrade, downgrade/upgrade, `alembic check`, RLS) are written but skipped until `TEST_POSTGRES_URL` exists. **Not yet run against a real database or the Supabase dev project.**
- [x] OR-005: Next.js 16.4.3 App Router in `frontend/` (TS strict + `noUncheckedIndexedAccess`, ESLint, Tailwind 4, shadcn init with no primitives). The layout shell (header/main/footer with disclaimer) and the homepage shell have no product data. Scripts: dev, build, start, lint, typecheck, test, test:e2e. `images.remotePatterns` is empty. Gate: lint, typecheck, test (6 pass) and build all pass. A Vitest guard fails on any `NEXT_PUBLIC_` name except `NEXT_PUBLIC_API_BASE_URL`.
- [ ] OR-006 onward: see `docs/jira-tickets-json/OR-E1-mvp1-scaffold.json`

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

---

## Completed Epics

| Epic | Summary | Completed |
|---|---|---|
| — | — | — |

---

*Last Updated: October 2026*
