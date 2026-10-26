# Backend AGENT.md — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Scope

This file governs all development within the FastAPI backend, including REST endpoints, services, repositories, database models, Alembic migrations, the Oriflame catalogue integration, referral configuration, and admin-only functionality.

---

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.12+ | Runtime |
| FastAPI | latest stable | Web framework |
| Pydantic | 2.x | Request/response schemas |
| pydantic-settings | 2.x | Typed configuration (env provider) |
| SQLAlchemy | 2.x | ORM / parameterised DB access |
| Alembic | latest stable | Schema migrations |
| Supabase (PostgreSQL) | per project | Persistent database (`POSTGRES_URL`) — see `docs/DATABASE.md` |
| psycopg | 3.x | PostgreSQL driver (`postgresql+psycopg://`, `sslmode=require`) |
| httpx | latest stable | Outbound HTTP (with timeouts) |
| structlog | latest stable | Structured logging |

Use compatible stable releases and record the pinned versions in `docs/ENGINEERING-STANDARDS.md`. Redis/background jobs only when justified by actual requirements.

---

## Architecture

Keep a clear separation between FastAPI routers, schemas, services, repositories, database models, external Oriflame integration code, referral configuration, catalogue synchronisation, and admin-only functionality.

```
backend/
├── AGENT.md                    # This file
├── app/
│   ├── api/v1/
│   │   └── endpoints/
│   │       ├── products.py     # Listing, detail (paginated)
│   │       ├── categories.py   # Category tree / category products
│   │       ├── search.py       # Search endpoint
│   │       ├── availability.py # Availability status (verified only)
│   │       ├── referral.py     # Referral handoff + click recording
│   │       └── admin.py        # Protected admin endpoints
│   ├── core/
│   │   ├── config.py           # Pydantic Settings + config-provider interface
│   │   ├── logging.py          # structlog configuration
│   │   └── security.py         # Admin auth, headers, rate limits
│   ├── db/
│   │   └── session.py          # SQLAlchemy engine/session
│   ├── models/                 # SQLAlchemy models
│   ├── schemas/                # Pydantic request/response models
│   ├── repositories/           # DB access (no business logic)
│   ├── services/
│   │   ├── products.py
│   │   ├── availability.py
│   │   └── referral.py         # ReferralService — single owner of referral logic
│   ├── integrations/
│   │   └── oriflame/
│   │       ├── client.py       # Permitted-source client (timeouts, retries)
│   │       └── catalogue.py    # Sync: idempotent upserts + sync-run records
│   └── main.py                 # FastAPI application entry point
├── alembic/                    # Migrations
└── tests/
    ├── conftest.py
    ├── unit/
    ├── integration/
    └── security/
```

Adjust structure when useful, but keep modules cohesive and avoid oversized files.

---

## Workflow Rules

| Rule | Behaviour |
|---|---|
| Layering | Routers → services → repositories → models. Routers hold no business logic; repositories hold no HTTP concerns |
| Referral ownership | All referral code/URL handling lives in `ReferralService`; nothing else constructs referral URLs |
| Config provider | Settings load through a typed `ConfigProvider` interface; environment variables are the initial (and only MVP) provider |
| Integration isolation | Oriflame source access lives only in `integrations/oriflame/` so a permitted source can be replaced later |
| Catalogue honesty | Never fabricate products, SKUs, prices, ratings, reviews, stock, or attribution |
| Single vendor | No tenant tables or tenant columns in the MVP; keep services free of global vendor assumptions so a tenant-aware provider can be introduced later |
| Migrations | Every schema change ships with an Alembic migration |
| Supabase | Connect only via `POSTGRES_URL`; no Supabase client SDK, anon key, or service_role key in the backend; exclude Supabase-managed schemas from Alembic autogenerate |
| Validation | All input validated with Pydantic; parameterised ORM operations only |
| Pagination | All catalogue list endpoints are paginated |
| Timeouts | Every outbound HTTP call has an explicit timeout and safe error handling |
| Type Safety | All public functions must have complete type annotations |
| Structured Logging | Use `structlog`; include a request id; never log secrets or the consultant code |
| Error Handling | Never catch generic `Exception`; always catch specific types |
| Imports | Module-level only; stdlib → third party → `backend.*`; run `ruff check backend --fix` for `I001` |
| Backend verification gate | After any backend touch, run the **full** four-command gate (no targeted pytest) before marking done |

---

## Backend Verification Gate

After **any** backend touch, run the **full** gate from the repository root **before marking the task complete**. Partial or targeted checks are not sufficient.

**Counts as a backend touch** (non-exhaustive): `backend/app/**`, `backend/alembic/**`, `backend/tests/**`, `pyproject.toml`, `.env.example`, and any file consumed by backend runtime settings.

```bash
uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest
```

| Step | Command | Pass criteria |
|---|---|---|
| 1 | `uv run ruff check backend` | Zero lint warnings (run `--fix` for import sort `I001`) |
| 2 | `uv run ruff format backend` | Formatting applied |
| 3 | `uv run mypy backend` | Zero type errors |
| 4 | `uv run pytest` | **All** tests pass (full suite — not a single file or directory) |

**Hard rules:**

- Do **not** mark a backend task complete, summarize as done, or commit until **all four** commands pass.
- Do **not** substitute targeted runs for step 4.
- Report actual results; never claim checks passed if they were not run.

---

## Referral Service

The referral code and referral URL are configuration, not constants in application source. Full rules: `docs/REFERRAL.md`.

- Load `ORIFLAME_COUNTRY`, `ORIFLAME_CONSULTANT_CODE`, `ORIFLAME_REFERRAL_URL`, `ORIFLAME_REFERRAL_METHOD` through the typed settings class.
- Resolve the referral destination on the server and validate its host against an allow-list of official Oriflame hosts.
- Use only an official referral URL or a documented, permitted referral mechanism. Do not assume appending a consultant code to an arbitrary URL creates attribution.
- If the official checkout requires manual code entry (`ORIFLAME_REFERRAL_METHOD=manual_code`), return instructions plus the code for a copy-code action.
- Never state a sale was attributed unless Oriflame confirms it.
- Define a lightweight `ConfigProvider` interface; env vars are the initial provider. Do not build a settings database/UI unless requested.

---

## Catalogue Integration

Full rules: `docs/CATALOGUE-DATA.md`.

- Investigate permitted sources (official APIs, product feeds, authorised exports) before implementing ingestion; record the decision as an ADR.
- Do not bypass authentication, anti-bot systems, access restrictions, or rate limits.
- Store `source_url` and `last_synced_at` for imported data.
- Idempotent upserts keyed on stable source identifiers — repeated sync must not duplicate records.
- Record every run in `catalogue_sync_runs` (status, counts, errors); support safe retries.
- If live inventory is unavailable, availability is "Check availability at Oriflame" or "Availability not confirmed". Never invent stock quantities.

---

## Initial Database Model

Supabase PostgreSQL + Alembic. Every table in `public` gets `ENABLE ROW LEVEL SECURITY` (no policies) in its migration. Keep the MVP schema minimal; do not create tenant tables.

| Table | Notes |
|---|---|
| `products` | Stable source id, SKU, slug (unique), name, description, price (PKR), source URL, last-synced timestamp, visibility/featured flags |
| `product_images` | FK → products; authorised assets only; alt text |
| `categories` | Slug (unique), parent FK |
| `product_variants` | Only if the source requires variants |
| `product_availability` | Only when meaningful source data exists |
| `catalogue_sync_runs` | Started/finished, status, counts, error detail |
| `admin_users` | If admin authentication is implemented |
| `audit_logs` | Meaningful admin actions |
| `referral_clicks` | Basic click analytics (no personal data) |

Use unique constraints, foreign keys, and indexes for product slug, SKU/source ID, category, and searchable fields. Avoid storing customer personal data unless a feature genuinely requires it.

---

## API Endpoint Pattern

- Versioned under `/api/v1`.
- Typed Pydantic response models; use `fastapi.status` constants.
- List endpoints accept `page`/`page_size` (bounded) and return total counts.
- Admin endpoints depend on an authentication + authorisation dependency — never publicly accessible.
- Narrow CORS (`CORS_ORIGINS`), secure headers, and rate limits where appropriate.

---

## Testing Requirements

| Area | Required tests |
|---|---|
| Referral | URL generation, host validation, manual-code fallback, missing-config behaviour |
| Configuration | Tenant-independent single-vendor configuration loads and validates |
| Catalogue | Upserts are idempotent; failed runs recorded; retries safe |
| API | Input validation, pagination bounds, 404s |
| Admin | Unauthenticated/unauthorised access rejected |

Unit tests in `tests/unit/`, API tests via `httpx` in `tests/integration/`, access-control tests in `tests/security/`. Mock external Oriflame sources — CI never hits real services.

---

## Error Handling

- Outbound calls: explicit timeouts; retries with backoff only where idempotent.
- Return safe, non-leaky error messages to clients; log details server-side with the request id.
- Sync failures are recorded on the sync-run row and never leave partial duplicates.

---

*Backend AGENT.md — Version 0.1.0 — October 2026*
