# Engineering Standards — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Twelve-Factor App Compliance

| Factor | Application |
|---|---|
| Codebase | One repo: `backend/`, `frontend/`, `infrastructure/`, `docs/` |
| Dependencies | Declared and locked (`uv.lock`, `package-lock.json`) |
| Config | Environment variables via Pydantic Settings; never in source |
| Backing services | Supabase PostgreSQL attached via `POSTGRES_URL` |
| Build, release, run | CI builds; migrations applied as a release step |
| Processes | Stateless API processes |
| Port binding | uvicorn (backend), Next.js server (frontend) |
| Dev/prod parity | PostgreSQL in all environments — Supabase for dev/prod, PostgreSQL container or local Supabase for tests (no SQLite substitute) |
| Logs | Structured JSON to stdout |
| Admin processes | Alembic migrations and catalogue sync run as one-off commands/endpoints |

---

## Technology Stack & Versions

Use compatible stable releases and **record the pinned versions here** when MVP 1 is scaffolded.

### Backend (Python)

| Package | Version | Notes |
|---|---|---|
| Python | 3.14 (`.python-version`; requires >=3.12) | Managed by `uv`; CI uses the same pin |
| FastAPI | 0.162.0 (Starlette 1.10.0, uvicorn 0.54.0) | App factory: `backend.app.main:create_app` |
| Pydantic / pydantic-settings | pydantic 2.14.1 / pydantic-settings 2.16.1 | mypy runs the `pydantic.mypy` plugin |
| SQLAlchemy | 2.1.6 | Typed declarative models |
| Alembic | 1.20.1 | `alembic.ini` at repo root; scripts in `backend/alembic/`; ruff-formats new revisions |
| psycopg[binary] | 3.3.6 | `POSTGRES_URL` normalised to `postgresql+psycopg://`; `sslmode=require` for Supabase |
| httpx / httpx2 | httpx 0.28.1 (AsyncClient tests) / httpx2 2.16.0 (Starlette TestClient) | Outbound httpx pinned when the first outbound call lands; explicit timeouts |
| structlog | 26.1.0 | JSON to stdout, `format_exc_info` (no locals in tracebacks) |
| pytest / pytest-cov | pytest 9.1.1 / pytest-cov 7.1.0 (coverage 7.17.0, fail_under 80) | pytest-asyncio 1.4.1 (auto mode), pytest-socket 0.8.1 (localhost only); `db` marker needs TEST_POSTGRES_URL |
| ruff / mypy | ruff 0.17.2 / mypy 2.4.0 | Run mypy as `uv run python -m mypy` on Windows (see lessons) |
| pip-audit | 2.10.1 | CI dependency audit; on this Windows setup run `uv run python -m pip_audit --skip-editable` |

### Frontend (TypeScript)

| Package | Version | Notes |
|---|---|---|
| Next.js | 16.4.3 | App Router only; `cacheComponents` on; `images.remotePatterns` empty until OR-E2 |
| React | 19.3.0 | |
| TypeScript | 5.9.3 | `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` |
| Tailwind CSS | 4.3.3 | CSS-first config in `app/globals.css` |
| shadcn/ui | 4.22.1 (style base-nova) | No primitives yet; `cn` helper at `lib/utils/cn.ts` |
| Zod | 4.6.7 | API responses validated in `lib/api/`; extra fields stripped |
| React Hook Form | not installed | Add with the first form (no forms in MVP 1) |
| Vitest / Testing Library / Playwright | Vitest 5.0.5 (+ coverage-v8) / RTL 16.3.3 + user-event / Playwright 1.64.1 (Chromium) | No `@vitejs/plugin-react` (peer conflict; not needed). Coverage: 75% lines, 90% for lib/api and lib/seo |

### Infrastructure

| Component | Version |
|---|---|
| Database | Supabase (managed PostgreSQL; version per project — check Dashboard → Settings → Infrastructure) |
| Test database | PostgreSQL matching the Supabase major version (container or `supabase start`) |
| Node.js | 24 LTS (pinned in `.nvmrc`) |
| Redis / background jobs | Not used unless justified by actual requirements |

---

## Configuration Management

### Environment Variables

```dotenv
# .env.example — Document all required variables

# Backend
POSTGRES_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

# Referral configuration — replace with real, approved values
ORIFLAME_COUNTRY=PK
ORIFLAME_CONSULTANT_CODE=
ORIFLAME_REFERRAL_URL=
ORIFLAME_REFERRAL_METHOD=official_url

# Tests only — local PostgreSQL, never the Supabase project
TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

Rules:

- `POSTGRES_URL` is the Supabase connection string (session pooler or direct, port 5432). See `docs/DATABASE.md`.

- Commit `.env.example` only; `.env`, local secrets, and generated files are in `.gitignore`.
- Private values never use a `NEXT_PUBLIC_` prefix.
- New variables are added to `.env.example`, this file (or `docs/REFERRAL.md`), and `infrastructure/DEPLOYMENT.md` in the same change.

### Pydantic Settings Validation

- One typed `Settings` class in `backend/app/core/config.py`, validated once at startup.
- `POSTGRES_URL` is a required `SecretStr`; scheme normalised to `postgresql+psycopg://`; never logged.
- `ORIFLAME_REFERRAL_METHOD` is a `Literal["official_url", "manual_code"]`.
- `ORIFLAME_REFERRAL_URL` is validated as HTTPS with an allow-listed official Oriflame host.
- Settings are consumed through a `ConfigProvider` interface (env provider for the MVP).

---

## Code Quality Standards

### Python

- `ruff check`, `ruff format`, and `mypy` must pass with zero errors.
- Modern type hints (`X | None`, built-in generics); full annotations on public functions.
- Imports: stdlib → third party → local; module-level only.
- Pydantic v2 patterns only (`model_config = ConfigDict(...)`, `field_validator`, `model_validator`).
- Catch specific exceptions; never bare `except` or generic `Exception`.
- Functions >50 lines are split; similar code in 3+ places is extracted.

### TypeScript

- `strict: true`, `noImplicitAny`, `noUncheckedIndexedAccess`.
- ESLint + `tsc --noEmit` pass with zero errors.
- Zod schemas are the source of truth for API types (`z.infer`).
- Server Components by default; `"use client"` only where interactive.

### Database

- Every schema change ships with an Alembic migration.
- Unique constraints, foreign keys, and indexes on slug, SKU/source id, category, and searchable fields.
- No customer personal data unless a feature genuinely requires it.

---

## Git & Review

- Conventional, descriptive commit messages.
- PRs use `.github/pull_request_template.md`; CI must be green before merge.
- Branch policy: `docs/EXECUTION-RULES.md` §9.

---

*Engineering Standards — Version 0.1.0 — October 2026*
