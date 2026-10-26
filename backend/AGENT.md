# Backend AGENT.md — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Scope

This file governs all development within the FastAPI backend, including REST endpoints, services, repositories, database models, Alembic migrations, the Oriflame catalogue integration, referral configuration, and admin-only functionality.

---

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.14 (`.python-version`; requires >=3.12) | Runtime |
| FastAPI | 0.162.0 | Web framework (app factory `create_app`) |
| Pydantic | 2.14.1 | Request/response schemas |
| pydantic-settings | 2.16.1 | Typed configuration (env provider) |
| SQLAlchemy | 2.1.6 | ORM / parameterised DB access |
| Alembic | 1.20.1 | Schema migrations |
| Supabase (PostgreSQL) | per project | Persistent database (`POSTGRES_URL`) — see `docs/DATABASE.md` |
| psycopg[binary] | 3.3.6 | PostgreSQL driver (`postgresql+psycopg://`, `sslmode=require`) |
| httpx | 0.28.1 | Runtime: `FeedHttpClient` for a future permitted feed (explicit timeouts); tests: `AsyncClient`, `MockTransport` |
| structlog | 26.1.0 | Structured logging |

Use compatible stable releases and record the pinned versions in `docs/ENGINEERING-STANDARDS.md`. Redis/background jobs only when justified by actual requirements.

---

## Architecture

Keep a clear separation between FastAPI routers, schemas, services, repositories, database models, external Oriflame integration code, referral configuration, catalogue synchronisation, and admin-only functionality.

```
backend/
├── AGENT.md                    # This file
├── app/
│   ├── api/
│   │   └── health.py           # GET /health, GET /health/ready (root, not versioned)
│   ├── api/v1/
│   │   ├── router.py           # api_router, mounted at /api/v1 (no endpoints yet)
│   │   └── endpoints/
│   │       └── products.py     # GET /api/v1/products, /api/v1/products/{slug}; (planned) categories, search, referral, admin
│   ├── core/
│   │   ├── config.py           # Settings, ReferralConfig, ConfigProvider; ALLOWED_REFERRAL_HOSTS (referral host allow-list)
│   │   ├── logging.py          # structlog JSON + RequestContextMiddleware (X-Request-ID, request_completed)
│   │   └── security.py         # (planned, OR-E6) admin auth, headers, rate limits
│   ├── db/
│   │   └── session.py          # Engine, session factory, get_db, URL-free connection errors
│   ├── models/
│   │   ├── __init__.py         # Imports every model so Base.metadata is complete for Alembic
│   │   ├── base.py             # DeclarativeBase + constraint naming convention
│   │   └── catalogue.py        # Product, ProductImage, Category, product_categories, CatalogueSyncRun
│   ├── schemas/
│   │   ├── catalogue.py        # ProductRecord, ImageRecord, CategoryRecord (validated sync input)
│   │   ├── products.py         # ProductQuery, ProductPage, ProductSummary, ProductDetail, Availability
│   │   ├── errors.py           # ErrorResponse
│   │   └── health.py           # HealthResponse, ReadinessResponse
│   ├── repositories/           # DB access only, no HTTP or business logic
│   │   ├── categories.py       # upsert_categories (two-pass parents), category_ids_by_source
│   │   ├── outcomes.py         # UpsertOutcome (created/updated/unchanged), WAS_INSERTED
│   │   ├── product_reads.py    # Visible-only listing (filters, sorts, descendant categories), detail, related
│   │   ├── products.py         # upsert_product: row + images + category links in one savepoint
│   │   ├── slugs.py            # new_slug: collision check against the database
│   │   └── sync_runs.py        # start/finish/fail_stale_runs, catalogue_sync_lock (advisory lock)
│   ├── services/
│   │   ├── availability.py     # availability_for: not_confirmed until a source provides availability (OR-021 completes)
│   │   ├── health.py           # ReadinessService (SELECT 1); (planned) referral (ReferralService)
│   │   ├── products.py         # ProductService: list/get, ProductNotFoundError
│   │   └── slugs.py            # slugify + deterministic collision suffix (source id)
│   ├── integrations/
│   │   └── oriflame/
│   │       ├── __init__.py     # get_catalogue_source(settings) - picks the CATALOGUE_SOURCE adapter
│   │       ├── catalogue.py    # CatalogueSyncService: lock, run row, batches, hide removed, final status
│   │       ├── client.py       # CatalogueSource Protocol, SourceError family, InvalidRecord, parse_records
│   │       ├── fixtures.py     # FixtureCatalogueSource (dev_fixture; strict; refuses APP_ENV=production)
│   │       └── http.py         # FeedHttpClient: timeouts, bounded retries, Retry-After, no auth bypass
│   ├── cli.py                  # python -m backend.app.cli sync [--fixtures] [--force-dev]
│   └── main.py                 # create_app() factory, CORS, 500 handler
├── fixtures/
│   └── dev_catalogue_sample.json  # Development-only placeholder catalogue (OR-015)
├── alembic/
│   ├── env.py                  # URL from Settings, skips Supabase-managed schemas, URL-free errors
│   ├── script.py.mako          # Migration template (RLS reminder)
│   └── versions/
│       ├── 001_baseline.py     # Empty schema; RLS on alembic_version
│       ├── 002_catalogue_schema.py  # Catalogue tables + sync_run_status enum; RLS on each
│       └── 003_product_source.py    # products.source (indexed; existing rows backfilled dev_fixture)
└── tests/
    ├── conftest.py             # clean_env, app/client/async_client, TEST_POSTGRES_URL db fixtures
    ├── unit/                   # config, db session, slugs, catalogue schemas, sources (fixture, mocked HTTP)
    ├── integration/            # health, request context, migrations, catalogue schema, repositories, sync, CLI (db)
    └── security/               # CORS, outbound network blocked
```

`alembic.ini` lives at the repository root; the referral host allow-list is `ALLOWED_REFERRAL_HOSTS` in `backend/app/core/config.py` (documented in `docs/REFERRAL.md`).

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
| `products` ✅ | `source_id` (unique), `source` (catalogue source name, indexed; `dev_fixture` marks development data), `sku` (indexed), `slug` (unique), name (`lower(name)` index), description, `price_pkr` (nullable, `> 0` when present; never 0 or guessed), `currency` (PKR only), `source_url`, `last_synced_at`, `is_visible`, `is_featured`, timestamps |
| `product_images` ✅ | FK → products, `ON DELETE CASCADE`; authorised assets only (empty while ADR-001 is Proposed); alt text; position unique per product |
| `categories` ✅ | `source_id` and `slug` unique; `parent_id` self-FK, `ON DELETE SET NULL` |
| `product_categories` ✅ | Composite PK; both FKs cascade, so deleting a product removes its memberships but never a shared category; `category_id` indexed |
| `product_variants` | **Omitted** (OR-011): ADR-001 confirms no source that provides variants |
| `product_availability` | **Omitted** (OR-011): no source data; the storefront labels availability "not confirmed" |
| `catalogue_sync_runs` ✅ | `source`, `started_at`/`finished_at`, `status` (enum `sync_run_status`: running, success, failed, partial), created/updated/unchanged/error counts, `error_detail` |
| `admin_users` | If admin authentication is implemented |
| `audit_logs` | Meaningful admin actions |
| `referral_clicks` | Basic click analytics (no personal data) |

Use unique constraints, foreign keys, and indexes for product slug, SKU/source ID, category, and searchable fields. ✅ = created by `002_catalogue_schema`.

**Catalogue upserts** (`repositories/`, OR-012): `INSERT ... ON CONFLICT (source_id) DO UPDATE ... WHERE` the source-owned fields (`sku`, `name`, `description`, `price_pkr`, `source_url`) differ; `xmax = 0` in `RETURNING` tells created from updated. With no field change only `last_synced_at` moves; `updated_at` moves only when a field, image or category link changed. A sync never overwrites `slug`, `is_visible` or `is_featured`. Images are replaced only when the ordered list differs. Unknown category ids are skipped and reported, never created. Category parents are linked in a second pass, so record order cannot violate the foreign key. Only one sync may run at a time: `catalogue_sync_lock` takes a PostgreSQL advisory lock on its own connection and raises `SyncAlreadyRunningError` otherwise.

**Catalogue sources** (`integrations/oriflame/`, OR-013): the sync sees only the `CatalogueSource` Protocol (`name`, `iter_categories()`, `iter_products()`). Each item is a validated record or an `InvalidRecord` (problems listed without input values); whole-source failures raise `SourceAuthError` (401/403, never retried), `SourceRateLimitedError`, `SourceUnavailableError`, `SourceMalformedError` or `SourcePageError` (a later page failed: the run is partial). `CATALOGUE_SOURCE` accepts only `fixture` until ADR-001 accepts a permitted source; any other value fails at startup. No integration code targets Oriflame's hosts, and a test enforces it.

**Catalogue sync** (`integrations/oriflame/catalogue.py`, OR-014): `CatalogueSyncService.run(source)` holds the advisory lock, fails any orphaned `running` row, records a new run, upserts categories then products (committed every 100), hides products the source no longer lists (never deletes), and finishes the row:

| Status | When |
|---|---|
| `success` | Every record saved; source read to the end |
| `partial` | Some records invalid or rejected by the database, or a later page failed (nothing hidden then) |
| `failed` | Whole-source error (auth, unreachable, rate limited, malformed), no valid products (the catalogue is never hidden on an empty source), or a database error outside a single record (recorded, then re-raised) |

Run counts are product outcomes. `error_detail` lists up to 50 lines (then "... and N more", capped at 4000 characters) and never contains input values, query strings or driver messages. Unknown category or parent references are noted there without counting as errors. Events: `catalogue_sync_started`, `catalogue_sync_finished`, `catalogue_sync_failed`, `catalogue_products_hidden`. A sync never sets `is_visible` back to true, so a product hidden earlier (by a sync or an admin) stays hidden when it reappears until OR-E6 provides an admin control.

Why each step is there: [`docs/learning/2026-10-idempotent-catalogue-upserts.md`](../docs/learning/2026-10-idempotent-catalogue-upserts.md); condensed example: [`docs/example-code/upsert-pattern.py`](../docs/example-code/upsert-pattern.py).

**Slugs** (`services/slugs.py`): `slugify(name)`; when another source row already holds it, append `-{slugify(source_id)}`. Source ids are unique, so the result does not depend on sync order. A numeric suffix is a last resort. Truncated to 200 characters with the suffix kept. Avoid storing customer personal data unless a feature genuinely requires it.

---

## API Endpoint Pattern

- Versioned under `/api/v1`.
- Typed Pydantic response models; use `fastapi.status` constants.
- List endpoints accept `page`/`page_size` (bounded) and return total counts.
- Query parameters are one Pydantic model (`Annotated[Model, Query()]`, `extra="forbid"`), so unknown or invalid parameters return 422 before any query runs. Path slugs are validated with `SLUG_PATTERN`.

### Products API (OR-018)

| Endpoint | Behaviour |
|---|---|
| `GET /api/v1/products` | Visible products only. `category` (slug; includes subcategories), `min_price`/`max_price` (products without a price never match), `sort` (`name_asc` default, `name_desc`, `price_asc`, `price_desc`, `newest`; unknown prices last), `page` (from 1), `page_size` (1 to 100, default 24). Returns `{items, total, page, page_size}`; a page past the end returns empty `items` with the real `total`. An unknown category returns no items |
| `GET /api/v1/products/{slug}` | Detail with images (by position), categories, `sku`, `description`, `source_url`, `last_synced_at` and up to 4 `related` products (shared category, by name). Hidden or unknown slugs return 404 `{"detail": "Product not found"}` |

Every product carries `price_pkr` (a decimal string, or `null` for "Price not available"), `availability` (`not_confirmed` with "Availability not confirmed" in lists and "Check availability at Oriflame" on detail) and `data_source` / `is_development_data`, so the UI can flag fixture data.
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
