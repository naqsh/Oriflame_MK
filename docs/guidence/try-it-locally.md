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

Until a permitted source is configured, load the explicitly named development fixtures (command defined in MVP 2). Fixture data is never presented as live Oriflame data.

---

## 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Site at `http://localhost:3000`.

---

## 6. Run Checks

```bash
uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
```

---

*Try It Locally — Version 0.1.0 — October 2026*
