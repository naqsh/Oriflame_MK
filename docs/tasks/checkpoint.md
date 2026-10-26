# Session Checkpoint: OR-E1 Merged, Ready for OR-E2

**Date:** October 26, 2026
**Repo:** `naqsh/Oriflame_MK` (**public**), local path `D:\Projects\OriflameMK` (Windows)
**Integration branch:** `epic/autonomus-implementation` at merge commit `b211b58` (PR #2)
**Status:** MVP 1 (OR-E1, OR-001 to OR-009) complete and merged. OR-E2 not started.

---

## Project

- **What it is:** a single-vendor referral storefront for Oriflame Pakistan. Visitors browse and shortlist products, then go to the official Oriflame site through the owner's referral link.
- **Out of scope:** multi-tenancy, billing and on-site checkout.
- **Never:** imply official Oriflame affiliation, or invent products, prices, stock or attribution.
- **Read first, in order:** `CLAUDE.md` → this file → `docs/tasks/lessons.md` → `AGENT.md` → `docs/PLAN.md` → `docs/EXECUTION-RULES.md`.

## Current state

- **MVP 1 is merged.** PR #2 merged `epic/E1-project-scaffold` into `epic/autonomus-implementation` as merge commit `b211b58` (parents `96b8240` and `e9d121f`).
- **Local checkout:** on `epic/autonomus-implementation`, pulled to `b211b58`. The local E1 branch is deleted; the remote `origin/epic/E1-project-scaffold` is kept.
- **`main`** holds only the docs and `LICENSE`. Epic work merges into the integration branch, never into `main`.

## Stack and versions

Full pins are in `docs/ENGINEERING-STANDARDS.md`.

- **Backend:** Python 3.14 (`.python-version`; `>=3.12` supported), managed by uv.
  - **Libraries:** FastAPI 0.162, Pydantic 2.14 and pydantic-settings 2.16, SQLAlchemy 2.1, Alembic 1.20, psycopg 3.3, structlog 26.1.
- **Frontend:** Next.js 16.4.3 (App Router, `cacheComponents` on), React 19.3, TypeScript 5.9 (strict, with `noUncheckedIndexedAccess`), Tailwind 4, Zod 4.6, Node 24 (`.nvmrc`).
  - **shadcn/ui:** set up, but no components added yet.
- **Database:** Supabase PostgreSQL through `POSTGRES_URL`.
  - **Connection:** port 5432 only; the 6543 pooler is rejected. The URL is converted to `postgresql+psycopg://`, with `sslmode=require` for Supabase hosts.
  - **Schema:** Alembic owns it. Every table in `public` has row-level security on with no policies; `001_baseline` does this for `alembic_version` too.
- **Tests:**
  - **Backend:** pytest, with coverage required at 80% or more. Tests marked `db` need `TEST_POSTGRES_URL`. They fail with setup instructions if it's missing, and refuse to run if it equals `POSTGRES_URL` or points at a Supabase host.
  - **Frontend:** Vitest, with coverage required at 75% or more overall and 90% for `lib/api` and `lib/seo`.
  - **End-to-end:** Playwright smoke tests.
  - **Network:** blocked in every test suite.
- **CI:** `.github/workflows/ci.yml` runs backend, frontend and e2e jobs. Actions are pinned to commit SHAs, permissions are read-only, and there are no secrets.

## What was built

- **Backend:**
  - **Settings:** typed settings behind a `ConfigProvider` interface (ADR-005). The referral host allow-list, `ALLOWED_REFERRAL_HOSTS = {"pk.oriflame.com"}` in `backend/app/core/config.py`, was confirmed by the owner.
  - **App:** `create_app()` factory (run with `uvicorn --factory`), `/health` and `/health/ready`, JSON logs with `X-Request-ID`, and a generic 500 handler.
  - **Database:** `get_db` sessions, and `env.py` reads the URL through settings.
- **Frontend:**
  - **Shell:** header, main and footer, with the "independent, not official Oriflame" disclaimer.
  - **API client:** `lib/api/client.ts`, with `fetchJson`, Zod validation and a typed `ApiError`.
  - **Status page:** `/status` (noindex) checks the backend on each request using `connection()`.
- **Results:** evidence is in `docs/tasks/todo.md` Review.
  - **Backend:** 58 tests pass, with 97.7% coverage.
  - **Frontend:** 18 Vitest tests and 2 Playwright tests pass.
  - **CI:** green. A deliberately broken commit turned it red and was then reverted.
  - **Fresh clone:** following `docs/guidence/try-it-locally.md` on a fresh clone reached a healthy `/status`.
- **Decisions and departures from the tickets:** ADR-006. Mistakes and their fixes: `docs/tasks/lessons.md`.

## Rules

- **Secrets:** the repo is public. Never commit `.env` or print its values. Check staged files for secrets before every commit.
- **Branching:**
  - **Start:** from `epic/autonomus-implementation`, create `epic/E{n}-{short}`.
  - **Merge:** open a PR back into it and merge with a **merge commit**.
  - **After merge:** delete the local epic branch but keep the remote one.
- **Before marking work done:**
  - **Backend checks:** `uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest`
  - **Frontend checks:** `cd frontend && npm run lint && npm run typecheck && npm run test && npm run build`
  - **Done:** never mark a ticket done without having run these.
- **Tickets:** in `docs/jira-tickets-json/OR-E{1..6}-*.json`. Track the plan and evidence in `docs/tasks/todo.md`, and record any mistakes in `lessons.md`.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Asking first:** this user commits, pushes and opens PRs only when they ask. Ask before anything visible on GitHub.

## Windows quirks

Details in `docs/tasks/lessons.md`.

- **Blocked launchers:** Application Control blocks `mypy.exe` and `pip-audit.exe`. Use `uv run python -m mypy backend` and `uv run python -m pip_audit --skip-editable`.
- **Leftover uvicorn worker:** stopping `uvicorn --reload` leaves a `multiprocessing.spawn` worker serving port 8000, so stop it too.
- **No plain `python` command:** use `uv run python`. The ticket JSON needs `json.loads(..., strict=False)`.
- **`NEXT_PUBLIC_API_BASE_URL`:** baked in at build time, so set it before `npm run build`.
- **Test database:** the Docker container `oriflame-test-db` (postgres:17) on port 54329. Use `TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:54329/postgres`.

## Open items

1. ~~**Post-merge cleanup**~~: done. Integration branch pulled, local E1 branch deleted, `todo.md` Completed Epics row updated.
2. **User's `.env`:**
   - In `POSTGRES_URL`, take the `[ ]` brackets off the password.
   - Delete the stray `POSTGRES_PASSWORD` line.
   - Add `TEST_POSTGRES_URL`.
   - Then run `uv run alembic upgrade head` against the Supabase dev project, which hasn't been tested yet.
3. **Postgres version:** check the Supabase project's Postgres major version against the `postgres:17` used in tests and CI (ADR-006).
4. **Dependabot:** optional, to keep the pinned action SHAs up to date.
5. **Decisions still needed from the user:**
   - **ADR-001:** catalogue data source (OR-010).
   - **ADR-002:** referral method (OR-029).
   - **ADR-003:** admin authentication (OR-044).
   - **ADR-004:** hosting (OR-052).

## Next

Start **OR-E2 (MVP 2: catalogue data)** on a new `epic/E2-...` branch from the updated integration branch. Begin with **OR-010**, which investigates permitted catalogue sources and records ADR-001. Ask the user before starting.

---

*Checkpoint written October 26, 2026*
