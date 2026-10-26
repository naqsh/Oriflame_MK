# Try It Locally — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

> Commands below are the target workflow. Update this guide with exact commands and versions when MVP 1 is scaffolded.

---

## Prerequisites

| Tool | Purpose |
|---|---|
| Python 3.12+ and `uv` | Backend |
| Node.js LTS and `npm` | Frontend |
| Supabase project | Database (managed PostgreSQL) — free tier is fine for development |
| Docker or Supabase CLI (optional) | Local PostgreSQL for running tests (`TEST_POSTGRES_URL`) |
| Git | Version control |

---

## 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
POSTGRES_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

ORIFLAME_COUNTRY=PK
ORIFLAME_CONSULTANT_CODE=
ORIFLAME_REFERRAL_URL=
ORIFLAME_REFERRAL_METHOD=official_url

CATALOGUE_SOURCE=fixture
```

Leave referral values empty locally unless you have real, approved values. Never commit `.env`.

---

## 2. Connect the Supabase Database

1. Create (or open) a Supabase project for development.
2. Dashboard → **Connect** → copy the **Session pooler** connection string (port `5432`). Use the *Direct connection* string only if your network supports IPv6.
3. Set it as `POSTGRES_URL` in `.env`, replacing `[YOUR-PASSWORD]` **including the brackets** with the database password (URL-encode special characters).
4. Do not create tables in the Supabase Table Editor — Alembic creates the schema in step 3.

For tests, point `TEST_POSTGRES_URL` at a local PostgreSQL (e.g. `supabase start` or a `postgres` Docker container), never at the Supabase project. The migration tests downgrade to `base` and drop the schema. Details: `docs/DATABASE.md`.

### Migration commands

```bash
uv run alembic upgrade head            # apply all migrations
uv run alembic downgrade base          # roll back everything (development only)
uv run alembic upgrade head --sql      # print the SQL without connecting
uv run alembic check                   # fail if models and migrations differ
uv run alembic revision --autogenerate -m "add products table"   # new migration
```

The URL comes from `POSTGRES_URL` via the typed settings, never from `alembic.ini`. On failure, Alembic exits non-zero with a message that never shows the URL. Examples: a malformed URL, a password still in `[ ]`, port 6543, or an unreachable host (the message suggests the Session pooler for the IPv6-only direct host).

---

## 3. Backend

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn backend.app.main:create_app --factory --reload
```

API at `http://localhost:8000`; liveness at `/health`, readiness (database check) at `/health/ready`, interactive docs at `/docs` (disabled when `APP_ENV=production`).

---

## 4. Development Catalogue (optional)

No permitted Oriflame source is confirmed yet (ADR-001), so load the development fixtures (12 placeholder products in `backend/fixtures/dev_catalogue_sample.json`). They are stored with `source = dev_fixture` and are never presented as live Oriflame data.

```bash
uv run python -m backend.app.cli sync --fixtures
```

The command prints the run id, status and counts. A second run reports `unchanged=12`.

| Exit code | Meaning |
|---|---|
| 0 | `success` or `partial` (the printed detail lists skipped records) |
| 1 | `failed`, the source is unusable, or a database error. The message never shows `POSTGRES_URL` |
| 2 | Usage or configuration error, e.g. `--fixtures` with `APP_ENV=production` |
| 3 | Another sync is already running |
| 4 | Products from another source exist. `--force-dev` overrides this, with `APP_ENV=development` only |

`uv run python -m backend.app.cli sync` (without `--fixtures`) uses `CATALOGUE_SOURCE`, which is `fixture` today.

---

## 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Site at `http://localhost:3000`. Requires Node 24 (`.nvmrc`).

The frontend calls the backend at `NEXT_PUBLIC_API_BASE_URL`. In `npm run dev` it defaults to `http://localhost:8000`. For a production build (`npm run build && npm start`), set it **before building**, because Next.js inlines it:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build
npm start
```

Check the connection at `http://localhost:3000/status` (noindex). It shows "Backend service: healthy" when the backend from step 3 is running, and a friendly "unavailable" message otherwise.

Frontend checks (run from `frontend/`):

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

---

## 6. Run Checks

### Test database (required for `uv run pytest`)

Tests marked `db` need a throwaway PostgreSQL. Without one they **fail** with a setup message; they are never silently skipped. Start one with Docker:

```bash
docker run -d --name oriflame-test-db -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:17
```

Then set `TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:54329/postgres` in `.env` or the environment. `supabase start` also works, using its local URL.

The suite refuses to run when `TEST_POSTGRES_URL` equals `POSTGRES_URL` or points at a hosted Supabase host. It downgrades and re-migrates that database once per session, and each test runs in a rolled-back transaction.

### Commands

```bash
uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
```

- `uv run pytest` reports coverage for `backend/app` and fails below 80%. Run `uv run pytest -m "not db"` for a quick run without a database; the full gate still needs the `db` tests.
- On this Windows setup, run mypy as `uv run python -m mypy backend` (Application Control blocks `mypy.exe`).
- `npm run test` runs Vitest with coverage: at least 75% overall and 90% for `lib/api` and `lib/seo`.
- Tests never reach the internet. pytest blocks Python sockets except to localhost, and Vitest rejects any `fetch` a test has not stubbed.

### End-to-end (Playwright)

```bash
cd frontend
npx playwright install chromium   # once
npm run test:e2e
```

`playwright.config.ts` starts the FastAPI backend (port 8000, placeholder settings, no database needed) and the Next.js dev server (port 3000), then runs `e2e/`. It reuses servers already running locally.

---

*Try It Locally — Version 0.1.0 — October 2026*
