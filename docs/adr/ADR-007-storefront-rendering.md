# ADR-007: Storefront Rendering Under Cache Components

**Status:** Accepted
**Date:** 2026-10-27
**Authors:** Claude Code Agent (OR-023 to OR-028)

## Context

The storefront (OR-E3) runs on Next.js 16.4.3 with `cacheComponents: true`. The tickets asked for ISR on the homepage (OR-023), `generateStaticParams` with revalidation for product pages (OR-025), and a 404 for unknown categories and products (OR-024, OR-025).

Two facts constrain this:

1. **The build has no backend.** `next build` runs in CI and locally without the FastAPI API or a catalogue database. Anything evaluated at build time (`"use cache"` functions filled during prerendering, `generateStaticParams`) would fail, hang until the 50-second cache-fill timeout, or bake a "catalogue unavailable" state into the static shell.
2. **Cache Components streams request-time data.** Reading `params`, `searchParams` or uncached data is only allowed inside `<Suspense>`. Once the shell has streamed, the HTTP status is already 200; `notFound()` inside the boundary renders the not-found UI with `<meta name="robots" content="noindex">` but cannot change the status (Next.js docs: `loading.md`, "Status codes").

## Decision

1. **Static shell, request-time data.** Each page prerenders what does not depend on data (layout, header search box, hero, headings where known, skeletons) and renders catalogue data per request inside `Suspense`, after `connection()` or by awaiting `params`/`searchParams`. Every route is a Partial Prerender (`◐`).
2. **No ISR or `generateStaticParams` yet.** Revisit with OR-052 (hosting): once the deploy build can reach the API, wrap the catalogue loaders in `"use cache"` with `cacheLife("minutes")`, tag them, and revalidate the tags after each catalogue sync; add `generateStaticParams` for visible products.
3. **Soft 404 for now.** Unknown or hidden products and categories render the not-found page with `noindex` and HTTP 200. A real 404 needs a check before rendering (Next.js Proxy). That belongs with the SEO work in OR-E5.
4. **Failures degrade, never crash.** Each data section catches `ApiError`, logs a value-free line (`*_failed kind=… status=…`) and shows a short "temporarily unavailable" notice, while the rest of the page renders.

## Other recorded deviations from the page specs

| Spec or ticket | What was built | Why |
|---|---|---|
| Query shown in the header search box (OR-026) | Shown in the `/search` page's own search form and heading | The header is part of the static shell; reading the URL there would make every page fully dynamic |
| Variants, ingredients and attributes on the product page | Not shown | No source provides them (ADR-001); the page shows sourced data only |
| Search rate limit (OR-020) | Deferred | One shared limiter for all public endpoints arrives with the hardening work in OR-E6 |
| `GET /api/v1/availability/{slug}` (OR-021) | Not added | The product detail payload already carries availability |
| Page titles for category, product and search-result pages | Category and product pages use the site default; search and list pages have static titles | Per-page metadata and JSON-LD are OR-E5 |
| Shopping-list freshness (OR-027) | One `GET /api/v1/products/{slug}` per item on `/list` | Needed to flag hidden or repriced items; only the product slug is sent, never the list or quantities |

## Consequences

### Positive
- `next build` succeeds without a backend, and CI stays secret-free and hermetic.
- Pages always show current catalogue data, and a backend outage never breaks a page or a build.

### Negative
- Every catalogue page view calls the API (no cross-request caching yet).
- Unknown products and categories return HTTP 200 (with `noindex`) until OR-E5.

### Neutral
- The prerendered `h1` and shell keep LCP independent of the backend (OR-023 measurements).

## Alternatives Considered

### Alternative 1: `"use cache"` loaders that swallow errors
- The build would cache an empty or unavailable catalogue for the cache lifetime. Rejected.

### Alternative 2: Disable Cache Components
- Gives up the static shell and Partial Prerendering for every route, and diverges from the Next.js 16 defaults the scaffold chose (ADR-006). Rejected.

### Alternative 3: Proxy check for every product and category slug now
- Adds an API round-trip before every catalogue request. Deferred to OR-E5, where it can be designed together with the SEO rules.

## References

- `frontend/AGENT.md` (Homepage rendering, Product listing and category pages, Product detail page, Search results page, Shopping list)
- `frontend/node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`, `03-api-reference/03-file-conventions/loading.md`
- ADR-001, ADR-006
