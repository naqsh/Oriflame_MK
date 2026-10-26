# ADR-006: Scaffold Toolchain Choices (MVP 1)

**Status:** Accepted
**Date:** 2026-10-26
**Authors:** Claude Code Agent (OR-001 to OR-008)

## Context

Several choices made during the OR-E1 scaffold were not dictated by the tickets, or deviate from them. They are recorded here so later epics do not undo them by accident. Exact versions are in `docs/ENGINEERING-STANDARDS.md`.

## Decision

| Area | Choice | Why |
|---|---|---|
| Python | 3.14 pinned in `.python-version` (`requires-python >=3.12`) | Matches the local environment; CI uses the same interpreter |
| Test/CI PostgreSQL | `postgres:17` (OR-008 named 16) | Same image as the local test container. **Revisit** to match the Supabase project's major version once it is checked |
| DB tests | `db` marker that **fails** with a setup message when `TEST_POSTGRES_URL` is unset; refuses `POSTGRES_URL` and Supabase hosts | OR-007: never silently skipped, never the hosted project |
| Alembic baseline | `001_baseline` enables RLS on `alembic_version` | The table lives in `public`, so Supabase's Data API could otherwise read it |
| FastAPI entry point | `create_app()` factory, `uvicorn --factory`; no module-level `app` | Importing the module never loads `.env` |
| Test HTTP client | `httpx2` for Starlette `TestClient`; `httpx` for `AsyncClient` | Starlette 1.10 deprecates `httpx` in `TestClient` |
| Test network | pytest-socket (localhost only); Vitest rejects unstubbed `fetch` | No test may reach Oriflame |
| Next.js rendering | `cacheComponents` on; request-time components call `await connection()` | Without it, `/status` froze its build-time result |
| Frontend API URL | `NEXT_PUBLIC_API_BASE_URL` required in production; set **before** `npm run build` | Next.js inlines `NEXT_PUBLIC_*` at build time |
| Backend status UI | Separate `/status` page (noindex), not the homepage | Keeps the homepage free of backend calls and SEO-neutral |
| Vitest | No `@vitejs/plugin-react` | Its optional Babel peers conflict with Next 16 (ERESOLVE); Vitest compiles TSX from tsconfig |
| shadcn/ui | Initialised with no primitives; `cn` at `lib/utils/cn.ts` | OR-005: add only primitives actually used |
| CI actions | Pinned to release commit SHAs; `contents: read`; no secrets | Public repository; supply-chain hygiene |
| Windows tooling | Run `mypy` / `pip-audit` as `python -m ...` locally | Application Control blocks their `.exe` launchers on the dev machine |

## Consequences

### Positive
- Local, CI and docs agree on versions and commands. Each deviation from a ticket is explicit.

### Negative
- Pinned action SHAs need deliberate updates (Dependabot or manual).
- `postgres:17` may differ from the Supabase major version until it is checked.

### Neutral
- Running the full backend gate locally requires Docker or `supabase start`.

## Alternatives Considered

### Alternative 1: Skip DB tests when no database is available
- Hides missing coverage. OR-007 requires a loud failure. Rejected.

### Alternative 2: `--legacy-peer-deps` to install `@vitejs/plugin-react`
- Masks a real conflict for no test benefit. Rejected.

## References

- `docs/tasks/lessons.md` (the mistakes behind several rows)
- `docs/guidence/try-it-locally.md`, `infrastructure/AGENT.md`
- ADR-005
