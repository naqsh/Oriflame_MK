# Catalogue, Images & Availability — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Purpose

Defines how product data enters the system and how it may be presented. The storefront must use accurate product names, descriptions, prices, images, variants, and availability **only** when obtained from permitted, reliable sources.

---

## Source Investigation (before any ingestion code)

Before implementing data ingestion, investigate permitted sources such as:

- Official APIs
- Product feeds
- Authorised exports

Record the chosen source, its terms, and image/content usage rights in an ADR (`docs/adr/`). Until a permitted source is confirmed, use only explicitly named development fixtures.

**Current decision:** [ADR-001](adr/ADR-001-catalogue-data-source.md) (Proposed, 2026-10-26). No permitted source is confirmed, so MVP 2 uses development fixtures only. Product images are omitted (no copying, no hot-linking) and there are no authorised image hosts.

---

## Current State (MVP 2)

- **Only development fixtures are in use.** ADR-001 is Proposed: no permitted source, terms or image rights are confirmed. Nothing is read from Oriflame's website.
- **Fixture file:** `backend/fixtures/dev_catalogue_sample.json`, loaded with `uv run python -m backend.app.cli sync --fixtures`. Rows are stored with `products.source = 'dev_fixture'`.
- **Sync cadence:** manual only, through the CLI (OR-016); an admin trigger follows in OR-E6. A schedule is decided when a real source is accepted.
- **Removal policy:** a product the source stops listing gets `listed_by_source = false` and leaves the storefront; it is never deleted, and only products of the same source are touched. When the source lists it again it comes back by itself.
- **Owner precedence (OR-048):** `is_visible` and `is_featured` belong to the owner (admin Products page) and no sync ever writes them. A product is on the storefront only when the owner shows it **and** the source lists it. Product facts (name, price, availability) always come from the source and cannot be edited in the admin.
- **Tables:** `products`, `product_images`, `categories`, `product_categories`, `catalogue_sync_runs`. No variant or availability tables: no source provides them, so availability is always "not confirmed".

---

## Source Selection

`CATALOGUE_SOURCE` picks the adapter in `backend/app/integrations/oriflame/`: `fixture` (development) or `csv`, the owner's own product list (`csv_source.py`, source name `owner_csv`; guide: [CATALOGUE-CSV.md](CATALOGUE-CSV.md)). The CSV source reads a local file only and makes no network requests; nothing is copied from Oriflame's website (ADR-001, Brand Partner terms 7.5 and 7.6). A bad row that still names its product code keeps that product listed with its last good version. An accepted source gets its own adapter behind the `CatalogueSource` Protocol and uses `FeedHttpClient`, which enforces timeouts, bounded retries, Retry-After limits and an immediate stop on 401/403.

---

## Ingestion Rules

| Rule | Detail |
|---|---|
| Access | Do not bypass authentication, anti-bot systems, access restrictions, or rate limits |
| Content rights | Do not assume product images/content may be copied or commercially republished. Confirm permissions and use authorised assets |
| No fabrication | Do not fabricate products, SKUs, prices, ratings, reviews, or stock |
| Provenance | Store source URL and last-synchronised timestamp for imported data |
| Idempotency | Use idempotent upserts keyed on stable source identifiers; repeated sync must not duplicate records |
| Failures | Record sync failures on `catalogue_sync_runs` and support safe retries |
| Isolation | Keep the integration in `backend/app/integrations/oriflame/` so a permitted source can be replaced later |

---

## Sync Runs

`CatalogueSyncService` (OR-014) records every run in `catalogue_sync_runs` as `success`, `partial` or `failed`; see `backend/AGENT.md` (Catalogue sync) for the rules. Only one sync runs at a time. A rerun after a failure is safe: committed batches are kept and upserts never duplicate. Products the source stops listing are unlisted, not deleted. An empty source fails the run instead of hiding the catalogue.

---

## Availability Rules

- If live inventory is unavailable, label availability as **"Check availability at Oriflame"** or **"Availability not confirmed."**
- Never invent stock quantities or describe stale data as real-time.
- Emit `Offer` structured data only when price/availability are verified (see `docs/SEO-AIO-GEO.md`).
- **Implementation (OR-021):** `backend/app/services/availability.py`. A source check counts as verified only for `AVAILABILITY_MAX_AGE_HOURS` (default 24); stock quantities are never returned. Today every product is `not_confirmed`, because no source provides availability.

---

## Development Fixtures

- Do not insert fake production catalogue data.
- If mock data is needed for UI development, isolate it in an explicitly named development fixture (e.g. `fixtures/dev_catalogue_*.json`) and never present it as live Oriflame data.
- Fixture loading must be impossible in `APP_ENV=production`.

**The shipped fixture** (OR-015) is `backend/fixtures/dev_catalogue_sample.json`:

- A `fixture_notice` starting "Development fixture - not live Oriflame data". Files without it are refused.
- 3 categories (`Sample Category A`, `A1` under `A`, `B`) and 12 products named `Sample Product 01` to `12`, with SKUs `DEV-0001` and up. Every third product has no price, and every fourth has no image, so the UI covers those cases.
- Images and source URLs point at `http://localhost:3000/dev-fixture/`, served from `frontend/public/dev-fixture/sample-product.svg`. No Oriflame names, SKUs, prices, hosts or images; a test enforces this.
- Loaded products get `products.source = 'dev_fixture'`, so the UI can show a "Development data" banner.
- Loading is all or nothing: a missing file, bad JSON or a single invalid record rejects the whole file.
- **No mixing:** a sync is refused when products from another source exist, in either direction (`MixedSourcesError`). The CLI's `--force-dev`, in development only, overrides this, and hiding still never touches the other source's products.

---

## Data Model Summary

See `backend/AGENT.md` → **Initial Database Model**. Minimal schema; no tenant tables; avoid storing customer personal data.

---

## Required Tests

- Upsert idempotency (run twice → same row count)
- Failed run recorded with error detail; retry succeeds without duplicates
- Availability labelling when no verified data exists
- Fixtures blocked in production mode

---

*Catalogue Data — Version 0.1.0 — October 2026*
