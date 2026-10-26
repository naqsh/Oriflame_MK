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

## Availability Rules

- If live inventory is unavailable, label availability as **"Check availability at Oriflame"** or **"Availability not confirmed."**
- Never invent stock quantities or describe stale data as real-time.
- Emit `Offer` structured data only when price/availability are verified (see `docs/SEO-AIO-GEO.md`).

---

## Development Fixtures

- Do not insert fake production catalogue data.
- If mock data is needed for UI development, isolate it in an explicitly named development fixture (e.g. `fixtures/dev_catalogue_*.json`) and never present it as live Oriflame data.
- Fixture loading must be impossible in `APP_ENV=production`.

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
