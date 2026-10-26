# Oriflame Pakistan Referral Store

An independent, single-vendor product discovery and referral storefront for Oriflame Pakistan products. Visitors browse, search, and shortlist products, then hand off to the official Oriflame Pakistan shopping/checkout experience via the owner's configured referral destination.

> **Disclaimer:** This is an independent referral storefront, **not** the official Oriflame website. It is not affiliated with or endorsed by Oriflame unless explicitly authorised. Checkout, payment, and fulfilment happen on Oriflame's official platform.

**Status:** MVP 1 (project scaffold), MVP 2 (catalogue data) and MVP 3 (storefront) are complete. The backend has the catalogue schema, an idempotent sync with run records, and a `sync` command. It uses **development fixtures only**, because no permitted Oriflame data source is confirmed yet ([ADR-001](docs/adr/ADR-001-catalogue-data-source.md)). MVP 3 (storefront) adds the homepage, product listing and category pages with filters, product pages, search and a browser-only shopping list. There are no referral handoff or admin features yet. See [`docs/PLAN.md`](docs/PLAN.md).  
**Repository:** [github.com/naqsh/Oriflame_MK](https://github.com/naqsh/Oriflame_MK)  
**Version:** 0.1.0 | October 2026

---

## Features (MVP)

- Responsive catalogue of Oriflame Pakistan products from permitted, reliable sources
- Search, category browsing, filter/sort, product detail pages
- Local shopping list/cart (no payment or address collection)
- "Buy from Oriflame" referral handoff (validated official referral URL or manual-code instructions)
- Technical SEO, AIO/GEO-friendly content, structured data (JSON-LD), accessibility, performance
- Protected admin area: catalogue sync status, referral configuration status, basic referral click analytics

**Out of scope for this phase:** multi-tenancy, vendor management, subscription billing, multi-vendor features, on-site checkout/payment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Zod |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy 2.x |
| Database | Supabase (managed PostgreSQL), SQLAlchemy 2.x, Alembic migrations |
| Testing | pytest, Vitest, Playwright |

Exact versions are documented in [`docs/ENGINEERING-STANDARDS.md`](docs/ENGINEERING-STANDARDS.md).

---

## Project Layout

```
OriflameMK/
├── AGENT.md                 # Root index & workflow rules (start here)
├── CLAUDE.md                # Pointer to AGENT.md for Claude Code
├── README.md
├── SECURITY.md
├── .claude/rules/           # Coding, refactor, testing, docs agent rules
├── .github/                 # PR template, CI workflows
├── backend/                 # FastAPI app (see backend/AGENT.md)
├── frontend/                # Next.js app (see frontend/AGENT.md)
├── infrastructure/          # CI/CD and deployment (see infrastructure/AGENT.md)
└── docs/                    # Architecture, standards, plan, tasks, ADRs
```

---

## Get the Code

```bash
gh repo clone naqsh/Oriflame_MK
cd Oriflame_MK
```

The repository is **public** — never commit `.env`, real consultant codes, or Supabase credentials (`.gitignore` excludes `.env`).

---

## Quick Start

Full instructions: [`docs/guidence/try-it-locally.md`](docs/guidence/try-it-locally.md).

```bash
cp .env.example .env          # set POSTGRES_URL (Supabase, password without [ ]) and referral values
uv sync                       # backend dependencies (Python 3.14 via .python-version)
uv run alembic upgrade head   # apply migrations to the database in POSTGRES_URL
uv run uvicorn backend.app.main:create_app --factory --reload   # API on :8000
cd frontend && npm ci && npm run dev                             # site on :3000 (Node 24)
```

Open `http://localhost:3000/status`; it shows "Backend service: healthy" when both are running. Tests and CI: see [`docs/guidence/try-it-locally.md`](docs/guidence/try-it-locally.md) (section 6).

---

## Database (Supabase)

The database is a **Supabase** project (managed PostgreSQL). The backend connects to it directly with SQLAlchemy using the connection string in `.env`:

| Variable | Value |
|---|---|
| `POSTGRES_URL` | Supabase connection string — Dashboard → **Connect** → *Direct connection* or *Session pooler* (port `5432`) |

```dotenv
POSTGRES_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

- Paste your password **without** the `[ ]` brackets shown in Supabase's template; URL-encode special characters.
- The *Direct connection* host (`db.<project-ref>.supabase.co`) is IPv6-only unless the IPv4 add-on is enabled — use the *Session pooler* string on IPv4-only networks.
- Schema is owned by **Alembic** — do not create or edit tables in the Supabase Table Editor.
- Row Level Security is enabled on every table so Supabase's public Data API cannot read them.

Full details: [`docs/DATABASE.md`](docs/DATABASE.md).

---

## Configuration

Referral code and referral URL are **configuration, not source constants**. See [`docs/REFERRAL.md`](docs/REFERRAL.md).

```dotenv
# Backend
POSTGRES_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

# Referral configuration — replace with real, approved values
ORIFLAME_COUNTRY=PK
ORIFLAME_CONSULTANT_CODE=
ORIFLAME_REFERRAL_URL=
ORIFLAME_REFERRAL_METHOD=official_url

CATALOGUE_SOURCE=fixture
```

Commit `.env.example` only — never `.env` or real codes/credentials.

---

## Documentation

| Topic | File |
|---|---|
| Workflow rules & index | [`AGENT.md`](AGENT.md) |
| Architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Database (Supabase) | [`docs/DATABASE.md`](docs/DATABASE.md) |
| Catalogue data rules | [`docs/CATALOGUE-DATA.md`](docs/CATALOGUE-DATA.md) |
| SEO / AIO / GEO | [`docs/SEO-AIO-GEO.md`](docs/SEO-AIO-GEO.md) |
| Security | [`docs/SECURITY.md`](docs/SECURITY.md) |
| Plan & acceptance criteria | [`docs/PLAN.md`](docs/PLAN.md) |
| Deployment | [`infrastructure/DEPLOYMENT.md`](infrastructure/DEPLOYMENT.md) |

---

*Oriflame Pakistan Referral Store — Version 0.1.0 — October 2026*
