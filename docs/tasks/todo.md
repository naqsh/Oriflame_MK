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
- [ ] OR-004 onward: see `docs/jira-tickets-json/OR-E1-mvp1-scaffold.json`

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
