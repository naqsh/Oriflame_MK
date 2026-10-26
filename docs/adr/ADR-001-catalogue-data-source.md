# ADR-001: Catalogue Data Source

**Status:** Proposed
**Date:** 2026-10-26
**Authors:** Claude Code Agent (OR-010), with answers from the store owner

## Context

MVP 2 brings Oriflame Pakistan product data into the system. `docs/CATALOGUE-DATA.md` requires a permitted, reliable source, with its terms and image/content rights recorded, before any ingestion code is written.

### Owner confirmation (2026-10-26)

- **Permitted source:** none yet. The owner has no official API, partner feed, or authorised consultant export for product data.
- **Terms of use, rate limits:** not confirmed for any source.
- **Image and description rights:** not confirmed. The owner chose to **omit product images** until permission exists.
- **Paid services:** none requested or used.

### What is publicly visible (read-only check, 2026-10-26)

A small number of public pages were read in a browser. Nothing was bulk-fetched, and no login, anti-bot measure or rate limit was touched.

| Item | Finding |
|---|---|
| `pk.oriflame.com/robots.txt` | Disallows `/customers/`, `/search`, `/system/`; points to `sitemap.xml` |
| Catalogue sitemap | `SiteMap/SiteMapXmlCatalog` lists about 400 product URLs of the form `/products/product?code={code}`, most with an image entry |
| Product page | Contains schema.org `Product` JSON-LD: `name`, `description`, `image`, `sku`, `brand`, `offers` (`price`, `priceCurrency` = PKR, `availability`), `aggregateRating`, `review` |
| Image host | `media-cdn.oriflame.com` |
| Terms and conditions | Published as a PDF on `media-cdn.oriflame.com` (linked from the site footer). **Not reviewed**: opening it starts a file download, which was not done. Its content-reuse terms are therefore unknown |

Technical accessibility is **not** permission. robots.txt governs crawling, not commercial republication of names, descriptions, prices or images.

## Decision

1. **No permitted source is confirmed.** MVP 2 builds the full pipeline (schema, idempotent upserts, sync runs, replaceable adapter in `backend/app/integrations/oriflame/`) against **explicitly named development fixtures only** (OR-015).
2. **Fixtures** are invented placeholders, clearly named (for example `fixtures/dev_catalogue_*.json`), never copied from pk.oriflame.com, never presented as live Oriflame data, and impossible to load when `APP_ENV=production`.
3. **Images are omitted.** The storefront shows a neutral placeholder and a "View on Oriflame" link. No Oriflame image is copied, stored or hot-linked. `next.config.ts` `images.remotePatterns` stays empty. **Authorised image hosts: none.**
4. **Availability** is labelled "Availability not confirmed" or "Check availability at Oriflame". No stock is shown as real-time.
5. **No ingestion from pk.oriflame.com** (sitemap, product pages or JSON-LD) is implemented until the owner records written permission from Oriflame in this ADR.

### Fields the schema must support

OR-011 models these fields so a permitted source can plug in later. Variants and availability would need a new migration when a source provides them. Each field is optional unless marked:

| Field | Notes |
|---|---|
| Source product id | **Required.** Stable key for idempotent upserts (on the public site this is the `code` query parameter) |
| SKU | Optional; may equal the source id |
| Name | **Required** |
| Description | Optional |
| Price (PKR) | Optional; never shown as verified without a confirmed source |
| Images | Optional; empty while ADR-001 is Proposed |
| Categories | Optional, many-to-many |
| Variants (shade, size) | Not modelled until a source provides them (OR-011 omitted the table) |
| Availability | Not modelled until a source provides it; the storefront shows "not confirmed" |
| `source_url`, `last_synced_at` | **Required** provenance on every imported product |

Ratings and reviews are **not** modelled.

### Sync cadence

Manual only (OR-016 CLI, later the admin trigger in OR-E6). A schedule is decided when a real source is accepted.

## Consequences

### Positive
- No legal or terms-of-use risk from copying Oriflame content or images.
- The pipeline, tests and storefront can be built and verified end to end now.
- The adapter boundary keeps the later switch to a permitted source to one module plus configuration.

### Negative
- The storefront cannot launch publicly with real products until a source is confirmed.
- Pages without images look plainer; conversions may be lower until images are permitted.

### Neutral
- Fixture products must be visibly labelled as development data in any non-production deployment.

## Alternatives Considered

### Alternative 1: Read product data from pk.oriflame.com pages or sitemap
- Data is technically available (JSON-LD with PKR prices).
- **Rejected for now:** no confirmed permission to republish, and the terms PDF has not been reviewed. Becomes viable only with written permission recorded here.

### Alternative 2: Consultant / Brand Partner export or partner feed
- Preferred future source if Oriflame provides one with clear reuse terms.
- **Not available:** the owner has no such access today.

### Alternative 3: Hot-link images from `media-cdn.oriflame.com`
- Avoids copying files but still displays Oriflame assets without permission.
- **Rejected** by the owner on 2026-10-26.

### Alternative 4: Scraping behind login, search or anti-bot protections
- **Never in scope** (`docs/CATALOGUE-DATA.md`). `/search` is also disallowed by robots.txt.

## Revisit when

- The owner obtains written permission from Oriflame Pakistan, or access to an official feed or export. Record the source, terms, rate limits and image rights here, set the status to **Accepted**, and add the authorised image host(s).
- Someone reviews the Oriflame Terms and Conditions PDF; record the relevant clauses here.

## References

- `docs/CATALOGUE-DATA.md`
- `backend/AGENT.md` (Catalogue Integration, Initial Database Model)
- `docs/jira-tickets-json/OR-E2-mvp2-catalogue-data.json` (OR-010 to OR-017)
- ADR-005 (configuration provider seam)
