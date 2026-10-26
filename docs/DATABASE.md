# Database — Supabase

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Decision

The persistent database is a **Supabase** project (managed PostgreSQL). Supabase is used **only as the PostgreSQL host** for the MVP — the FastAPI backend connects directly with SQLAlchemy 2.x and owns the schema through Alembic. Supabase Auth, Storage, Realtime, and the client SDKs (`supabase-js` / `supabase-py`) are not used unless a later ADR adopts them.

---

## Connection

| Variable | Where | Purpose |
|---|---|---|
| `POSTGRES_URL` | `.env` (backend only) | Supabase connection string used by the app and by Alembic |
| `TEST_POSTGRES_URL` | `.env` / CI | Separate local or throwaway database for tests — never the Supabase project |

`POSTGRES_URL` is server-side only: never prefix it with `NEXT_PUBLIC_`, never log it, never commit it.

### Which Supabase connection string

Dashboard → **Connect**:

| Mode | Host / port | Use |
|---|---|---|
| Direct connection | `db.<project-ref>.supabase.co:5432` | App + Alembic. IPv6-only unless the IPv4 add-on is enabled |
| Session pooler | `aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<project-ref>` | App + Alembic on IPv4-only networks (**recommended default**) |
| Transaction pooler | `...pooler.supabase.com:6543` | **Not used** — breaks Alembic and needs prepared statements disabled |

Format:

```dotenv
POSTGRES_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

- Replace `[YOUR-PASSWORD]` including the brackets; URL-encode special characters in the password.
- One variable holds the full URL — there is no separate password variable.

### Settings handling

- `Settings.postgres_url` reads `POSTGRES_URL` (Pydantic Settings, `SecretStr`).
- Scheme normalised for SQLAlchemy: `postgres://` / `postgresql://` → `postgresql+psycopg://`.
- `sslmode=require` enforced when the host is a Supabase host.
- Missing or malformed `POSTGRES_URL` fails startup with a message that never includes the URL.
- Port `6543` (transaction pooler) is rejected at startup.
- Implemented in `backend/app/core/config.py` (`normalise_postgres_url`, `load_settings` → `ConfigurationError`).

---

## Schema Ownership (Alembic)

- Every table, index, and constraint is created by an Alembic migration — never in the Supabase Table Editor or SQL editor.
- Run migrations from a developer machine or CI deploy step: `uv run alembic upgrade head`.
- Supabase-managed schemas (`auth`, `storage`, `realtime`, `extensions`, …) are excluded from autogenerate (`include_name` filter in `alembic/env.py`) so Alembic never tries to drop them.
- Extensions (e.g. `pg_trgm` for search in OR-020) are enabled inside migrations with `CREATE EXTENSION IF NOT EXISTS ... WITH SCHEMA extensions`.

---

## Data API Exposure (Security)

Supabase exposes tables in the `public` schema through its auto-generated Data API, reachable with the project's public anon key. Because this app reads and writes only through FastAPI:

- Every migration that creates a table in `public` also runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and defines **no** policies — the Data API returns nothing, while the backend's direct `postgres` connection is unaffected.
- The baseline (`001_baseline`) does the same for `alembic_version`, which Alembic creates in `public`. The migration template (`backend/alembic/script.py.mako`) carries this reminder.
- A test asserts RLS is enabled on every application table.
- Optionally also remove `public` from *Exposed schemas* in Supabase API settings.
- The anon and `service_role` keys are not used by this app and must never be added to the frontend.

---

## Environments

| Environment | Database |
|---|---|
| Local development | Supabase project (dev) via `POSTGRES_URL`, or local Supabase via `supabase start` |
| Tests / CI | `TEST_POSTGRES_URL` → PostgreSQL service container or local Supabase — never the hosted project |
| Production | Separate Supabase project; `POSTGRES_URL` set in deployment secrets |

Use a separate Supabase project for production; do not share a database between development and production.

---

## Backups & Limits

- Backups follow the Supabase plan in use; confirm retention before launch (ask before upgrading to a paid plan).
- Free-tier projects pause after inactivity — expect a cold start in development.
- Connection limits depend on plan and pooler mode; keep the SQLAlchemy pool small (e.g. `pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`).

---

*Database — Version 0.1.0 — October 2026*
