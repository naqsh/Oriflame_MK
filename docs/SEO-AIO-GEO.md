# SEO, AIO & GEO — Oriflame Pakistan Referral Store

**Version:** 0.2.0 | **Last Updated:** October 2026 (OR-E5 as built)

---

## Goal

Apply technical SEO, useful content practices for AI-assisted search (AIO/GEO), accessibility, and performance best practices. SEO/AIO/GEO work must improve clarity and usefulness, **not promise ranking outcomes**.

---

## Configuration

| Setting | Effect |
|---|---|
| `SITE_URL` | Public origin for canonical URLs, Open Graph, the sitemap and robots.txt. Required for production **builds** (static metadata is resolved at build time); development falls back to `http://localhost:3000`. |
| `APP_ENV` | Only `production` is indexable. Anything else (development, test, staging) serves `Disallow: /` and an empty sitemap. |

Code: `frontend/lib/seo/site.ts`.

---

## Metadata and canonical policy

- Every page builds its metadata with `buildMetadata()` (`frontend/lib/seo/metadata.ts`): title, description, canonical, Open Graph and Twitter card.
- **Canonical URLs never carry a query string or fragment.** Filtered, sorted, paged and tracking-parameter variants of a page all canonicalise to the bare path (e.g. every `/products?…` → `/products`).
- Descriptions come from factual product or page text, trimmed to about 155 characters at a word boundary (`describe()`).
- Product and category metadata: `frontend/lib/seo/catalogue-metadata.ts`. A missing product or category gets "not found" metadata with `noindex`.

## Noindex policy

| Page | Indexed? |
|---|---|
| Any page when `APP_ENV` ≠ `production` | No (robots.txt `Disallow: /`) |
| Product pages built from development fixtures | No (`noindex`) |
| Guides without owner approval, and `/guides` while none is approved | No (`noindex`) |
| `/search`, `/list`, `/admin`, `/api` | Disallowed in robots.txt |
| Not-found pages | No. With `cacheComponents`, a `notFound()` inside Suspense returns HTTP 200 with `noindex` (a "soft 404"). |
| Everything else in production | Yes |

## Sitemap scope

`frontend/app/sitemap.ts` → `sitemapEntries()` in `frontend/lib/seo/crawl.ts`, rendered per request (the build has no backend; an API failure fails the request instead of publishing an empty file).

Included, production only:

- `PUBLIC_PAGES`: `/`, `/products`, `/referral`, `/about`, `/contact`, `/privacy`, `/terms`, `/cookies`.
- Owner-approved guides and, once any is approved, `/guides` (`publishedGuidePaths()`).
- Every visible, non-fixture product, with `lastModified` = `last_synced_at`.
- Categories (at any depth) that have at least one visible product.

Excluded: fixture products, empty categories, unapproved guides, private paths. Capped at 50,000 URLs (split with `generateSitemaps` beyond that).

## robots.txt

`frontend/app/robots.ts`: production allows `/`, disallows `PRIVATE_PATHS` (`/admin`, `/api`, `/search`, `/list`) and points to `/sitemap.xml`. Every other environment disallows everything.

---

## Structured data (JSON-LD) rules

Builders: `frontend/lib/seo/jsonld.ts`. Rendered by `components/layout/json-ld.tsx` through `serializeJsonLd()`, which escapes `<`, `>`, `&`, U+2028 and U+2029 so catalogue text cannot close the script tag.

| Type | Where | Rule |
|---|---|---|
| `WebSite` (+ `SearchAction`) | Homepage | Always |
| `Organization` | Homepage | This independent store, described with the disclaimer. **Never Oriflame.** |
| `BreadcrumbList` | Category pages, product pages, guides | Mirrors the visible breadcrumbs. Product trail goes through the primary (alphabetically first) category and its ancestors. |
| `Product` | Product pages | Real catalogue data only; **development fixtures emit nothing**. Brand is the factual product brand "Oriflame". |
| `Offer` | Inside `Product` | Only when a PKR price is known **and** availability is verified (`verified_in_stock` / `verified_out_of_stock`). No source verifies availability today, so **no Offer is emitted**. |
| `FAQPage` | `/referral` | Only because the page visibly is that list of questions; the JSON-LD mirrors the visible text word for word (`lib/content/faq.ts`). |
| `aggregateRating`, `Review` | — | **Never.** |

Pattern: [`docs/example-code/jsonld-pattern.ts`](example-code/jsonld-pattern.ts). Rationale: [`docs/learning/2026-10-truthful-structured-data.md`](learning/2026-10-truthful-structured-data.md).

---

## Content (AIO/GEO)

| Page | Source | Notes |
|---|---|---|
| `/about`, `/contact`, `/privacy`, `/terms`, `/cookies` | `frontend/app/*/page.tsx` with `components/content/content-page.tsx` | One h1, last-updated date, "awaiting owner review" notice until `CONTENT_REVIEWED` (`lib/content/review.ts`) is set. Contact details from optional `CONTACT_EMAIL` / `CONTACT_WHATSAPP`. |
| FAQ on `/referral` | `frontend/lib/content/faq.ts` | Ordering, payment and delivery, consultant code, PKR price accuracy, availability labels. |
| Guides `/guides/[slug]`, `/guides` | `frontend/lib/content/guides.ts` | Typed content. Published only when `approval` records the owner and date; until then noindex and out of the sitemap. |

Privacy and cookie statements are verified against the code (no cookies; only browser storage is the shopping list; request logs hold no IP; anonymous click counts). Re-check them whenever logging, storage or third-party scripts change.

Tests (`__tests__/guides-faq.test.tsx`) reject unconfirmed promises (delivery times, discounts, guarantees) and efficacy claims in FAQ and guide text.

---

## Performance

- PDP main image is the likely LCP image: `preload` with page-specific `sizes`. Other images lazy-load with explicit dimensions.
- Streaming layout shift is prevented by reserving the category-nav line and giving `main` a viewport min-height.
- Fonts via `next/font` (self-hosted); the mono font is not preloaded.
- Development-only Web Vitals console logging (`components/status/web-vitals.tsx`); no analytics endpoint is approved.
- Lab results and open items: `docs/tasks/todo.md` (OR-042).

---

## Prohibited

- Fake reviews or ratings
- Unsupported medical/beauty claims
- Misleading availability
- Keyword stuffing
- Mass-generated thin pages
- Implying official Oriflame affiliation or endorsement
- Promising rankings, delivery times or discounts

---

## Verification

- Unit tests: `seo-metadata`, `seo-crawl`, `seo-jsonld`, `content-pages`, `guides-faq`, `performance` (`frontend/__tests__/`).
- Validate JSON-LD with an external structured-data validator once a public URL exists (not yet done: no public deployment).
- Check sitemap and robots.txt in the deploy smoke test (`infrastructure/DEPLOYMENT.md`).
- Monitor Core Web Vitals (`docs/OBSERVABILITY.md`).

---

*SEO, AIO & GEO — Version 0.2.0 — October 2026*
