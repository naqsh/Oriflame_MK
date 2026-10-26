# Frontend AGENT.md — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Scope

This file governs all development within the Next.js (App Router) frontend. The frontend renders the product catalogue, search, category browsing, product detail pages, the local shopping list, the "Buy from Oriflame" handoff, content/legal pages, SEO metadata, and the protected admin views.

---

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.4.3 | React framework with App Router |
| React | 19.3.0 | UI library (Server Components first) |
| TypeScript | 5.9.3 | Type safety (strict, `noUncheckedIndexedAccess`) |
| Tailwind CSS | 4.3.3 | Utility-first styling |
| shadcn/ui | 4.22.1 | Accessible UI primitives where useful (add with `npx shadcn@4.22.1 add <name>` only when used) |
| Zod | 4.6.7 | Runtime schema validation |
| React Hook Form | not installed | Forms (add with the first form) |
| Vitest + Testing Library | 5.0.5 / 16.3.3 | Component/unit tests |
| Playwright | 1.64.1 | End-to-end tests (config and browsers: OR-007) |

---

## Architecture

```
frontend/
├── AGENT.md                    # This file
├── app/
│   ├── layout.tsx              # Root layout: html lang, SiteShell, title template + description
│   ├── page.tsx                # Homepage: static hero + how-it-works, HomeCatalogue streamed per request
│   ├── products/page.tsx       # All products: static h1, ProductsResults streamed (filters, sort, pages)
│   ├── products/[slug]/page.tsx    # Product detail: ProductDetailContent streamed
│   ├── categories/[slug]/page.tsx  # CategoryContent streamed: breadcrumb, h1, subcategories, listing
│   ├── search/page.tsx         # Search (noindex): SearchResults streamed
│   ├── not-found.tsx           # Root 404 UI (links home and to all products)
│   ├── status/page.tsx         # Backend status (noindex), request-time BackendStatus
│   ├── globals.css             # Tailwind 4 + shadcn theme tokens
│   └── (planned) referral/, about/, contact/,
│       privacy/, terms/, admin/, sitemap.ts, robots.ts (JSON-LD in layout: OR-E5)
├── components/
│   ├── catalogue/              # products-results, category-content, product-detail, search-results (page bodies)
│   ├── filters/                # filter-panel, sort-select (Client), pagination, product-listing
│   ├── home/                   # home-catalogue (featured or latest products, categories), how-it-works
│   ├── layout/                 # site-header (search + category nav), site-footer (disclaimer), site-shell,
│   │                           # category-nav (request-time, omitted if the API fails), dev-data-banner
│   ├── product/                # price, availability-badge, product-image, product-card, product-grid
│   ├── search/                 # search-box (GET form to /search, no JS)
│   ├── status/                 # backend-status (Server Component)
│   └── referral/, ui/          # (planned; empty, .gitkeep)
├── lib/
│   ├── api/                    # client.ts (fetchJson, ApiError), catalogue.ts (getProducts, getProduct,
│   │                           # getCategories, getCategory, searchProducts), schemas/{catalogue,health}.ts
│   ├── categories.ts           # categoryOptions: flatten the tree for a <select>
│   ├── images.ts               # AUTHORISED_IMAGE_HOSTS (empty, ADR-001), authorisedImageSrc
│   ├── search.ts               # parseSearchParams (trim, cut to 100), searchHref
│   ├── text.ts                 # toParagraphs: source text/HTML to plain paragraphs (never raw HTML)
│   ├── listing.ts              # parseListingParams (normalise URL state), listingHref, SORT_OPTIONS
│   ├── seo/                    # site.ts (name, description, disclaimer); (planned) metadata/JSON-LD builders
│   └── utils/                  # cn.ts (shadcn class helper)
├── types/                      # (planned; empty, .gitkeep)
├── __tests__/                  # Vitest specs (incl. NEXT_PUBLIC_ guard, network guard)
├── e2e/                        # Playwright smoke specs
├── next.config.ts              # cacheComponents; images.remotePatterns from AUTHORISED_IMAGE_HOSTS (empty)
├── vitest.config.mts           # jsdom, coverage thresholds (75%; 90% lib/api, lib/seo)
├── vitest.setup.ts             # jest-dom, cleanup, fetch blocked unless stubbed
├── playwright.config.ts        # Starts backend + Next dev server
└── components.json             # shadcn config (utils alias @/lib/utils/cn)
```

Adjust structure when useful, but keep modules cohesive and avoid oversized files.

### Catalogue UI building blocks (OR-022)

| Piece | Rule |
|---|---|
| `lib/api/schemas/catalogue.ts` | Zod schemas mirroring the backend; prices are decimal strings or `null`, timestamps need a timezone, image URLs must be http(s). A malformed payload is an `ApiError("invalid_response")` |
| `lib/api/catalogue.ts` | `getProduct` / `getCategory` return `null` on 404 or a malformed slug (pages call `notFound()`); other failures throw |
| `Price` | `Intl.NumberFormat("en-PK", PKR)`: "Rs 1,499", "Rs 999.50"; `null` shows "Price not available", never 0 |
| `AvailabilityBadge` | Shows the backend's label as is; adds the check time (Asia/Karachi) only for verified statuses |
| `ProductImage` | `next/image` only for `authorisedImageSrc` URLs: our `/dev-fixture/` placeholders, or hosts in `AUTHORISED_IMAGE_HOSTS` (none). Anything else, or no image, renders a "No image available for …" placeholder |
| `ProductCard` | One link named after the product; long names clamped to two lines with the full name in the accessible text and `title` |
| `DevDataBanner` | Renders only if an item has `data_source === "dev_fixture"` / `is_development_data` |
| `CategoryNav` | Request-time (`connection()`) inside `Suspense` in the header; top-level categories with products; omitted, with a log line, if the API fails. Because of it every route is a Partial Prerender (`◐`) |

All of these are Server Components; none needs `"use client"`.

### Search results page (OR-026)

- `/search?q=&page=` reads the query from the URL. `q` is trimmed and cut to 100 characters (the backend limit) before any request; an empty or whitespace-only `q` shows a prompt and calls no API.
- The page has its own GET search form with the query filled in (the header box lives in the static layout shell, which cannot read the URL without making every page dynamic). Both forms work without JavaScript.
- The heading echoes the query as React text, so markup in a query is shown escaped, never rendered.
- Results reuse `ProductGrid`, the announced count and `Pagination` (which now takes an `hrefFor(page)` function, shared with the listing pages).
- With no results it suggests the 4 categories with the most products plus "Browse all products"; if categories fail, only the message shows. HTTP 429 shows "Search is busy right now. Please try again shortly."; other failures show "temporarily unavailable".
- `metadata.robots` is `noindex, follow` (to be finalised with the other SEO rules in OR-E5).

### Product detail page (OR-025)

- **Only sourced data:** name, SKU, price, availability, images, description, categories and related products, as the API returns them. Sections with no data are left out entirely (no empty headings). Variants and ingredients are not shown because no source provides them (ADR-001), and no claims are added.
- **Description:** `lib/text.ts` turns source text or HTML into plain paragraphs. Tags, scripts, styles and attributes are dropped and common entities decoded, and React renders the result as text, so source HTML is never rendered raw.
- **Images:** a gallery of authorised images (first large, the rest as thumbnails), or the neutral "No image available for …" placeholder.
- **Source link:** for real data, "View this product on {host}" with `target="_blank"` and `rel="noopener noreferrer"`. Development fixtures have no official page, and the page says so instead of linking.
- **Honesty notes:** "Checkout and fulfilment happen on Oriflame's official platform", and the date the details were last updated from the source.
- **Reserved slots:** empty `data-slot="referral-handoff"` (OR-E4 "Buy from Oriflame") and `data-slot="add-to-list"` (OR-027).
- **No `generateStaticParams` yet:** it runs during `next build`, which has no backend (same reason as the homepage). Pages render per request; add static params with revalidation alongside OR-052. Hidden or unknown slugs call `notFound()` (soft 404 with `noindex`, as for categories).

### Product listing and category pages (OR-024)

- **URL is the state:** `?category=&min_price=&max_price=&sort=&page=`, so results are shareable and back/forward restore them. `lib/listing.ts` normalises anything invalid (negative or non-numeric page, unknown sort, malformed price or slug) to defaults, so a bad URL never becomes a backend 422. A minimum price above the maximum is swapped, and the page says so.
- **Client Components only where needed:** `FilterPanel` is a GET form (it works without JavaScript; with it, `router.push` keeps navigation client-side) and `SortSelect` pushes on change. Both reset to page 1 and are keyed by the URL state so their fields follow back/forward. Everything else is a Server Component.
- **Accessibility:** labelled fields; the result count is `role="status"` with `aria-live="polite"`; pagination is a `nav` with `rel="prev"`/`rel="next"` links and "Page N of M"; breadcrumbs mark the current page with `aria-current`.
- **States:** no results shows "No products match these filters" with a "Clear filters" link; a page past the end offers "Go to the first page"; a backend failure shows a short notice.
- **Category pages** take the category from the path (`?category=` is ignored there), show subcategories that have products, and have no category filter.
- **Not found status:** page bodies read `params`/`searchParams`, which Cache Components only allows inside `Suspense`, so `notFound()` runs after streaming starts. Next.js then serves the not-found UI with `<meta name="robots" content="noindex">` and **HTTP 200** (a soft 404; see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`, "Status codes"). A real 404 status needs a check in Proxy before rendering; that is left for OR-E5 (SEO).
- **Tests:** `__tests__/render-server.tsx` resolves nested async Server Components so page bodies can be rendered in Vitest.

### Homepage rendering (OR-023)

- **Static shell:** the hero (`h1`) and "How it works" are prerendered. The `h1` is the LCP element, so the largest paint never waits for the backend.
- **Streamed catalogue:** `HomeCatalogue` calls `connection()` and renders per request inside `Suspense`, with a grid-sized skeleton as the fallback. It shows featured products (`featured=true`); if the owner has featured none, it shows the 8 newest under "Latest products". It also shows "Shop by category" for top-level categories that have products.
- **States:** an empty catalogue shows "No products are listed yet"; a backend failure shows "The catalogue is temporarily unavailable" and logs `home_catalogue_failed`; the rest of the page still renders.
- **Why not ISR (`use cache` + `cacheLife`) yet:** a cached function runs during `next build`, and the build (CI and local) has no backend, so it would fail or cache the unavailable state. Revisit with OR-052 (hosting): once the deploy build can reach the API, wrap the data loaders in `"use cache"` with `cacheLife("minutes")` and tag them for revalidation after a catalogue sync.
- **Branding:** no Oriflame logos or trademark-style branding; the wording says "independent storefront" and that checkout happens on Oriflame's official website. A test rejects "official store", "authorised seller" and similar claims.

---

## Workflow Rules

| Rule | Behaviour |
|---|---|
| Server Components First | Use Server Components by default; Client Components only for interactive UI (filters, shopping list, copy-code) |
| Type Safety | All API responses validated with Zod before use |
| No referral logic in UI | Never construct referral URLs in components — render the server-resolved destination from the API |
| No private env in browser | Never use a `NEXT_PUBLIC_` prefix for the consultant code unless confirmed intentionally public |
| No checkout data | Do not collect payment card details or delivery addresses — checkout happens on Oriflame |
| Honest availability | Show only verified availability; otherwise "Check availability at Oriflame" / "Availability not confirmed" |
| Fixtures | Development mock data lives in an explicitly named fixture module and is never presented as live Oriflame data |
| Accessibility | Semantic HTML; all interactive elements keyboard-operable with accessible names |
| Images | Use Next.js image optimisation; authorised assets only; factual alt text |
| Loading & errors | Every async boundary has loading and error states |
| Frontend verification gate | `npm run lint && npm run typecheck && npm run test && npm run build` must pass before marking done |

---

## Page Specifications

Required pages: homepage, product listing and category pages, product detail page, search results, referral/how-to-buy page, about and contact pages, privacy policy, terms, and cookie information as applicable.

### Product Detail Page

Show, where available:

- Product name, images, description, price (PKR) and variants
- Verified availability status
- Product attributes/ingredients only when sourced
- Related products
- Official product source link
- "Buy from Oriflame" referral handoff
- Clear note that checkout and fulfilment happen on Oriflame's official platform

### Shopping List / Cart

- Local only (browser storage); no account, no payment, no address.
- Handoff lists items and sends the visitor to the configured referral destination or shows manual-code instructions with a copy-code action.

---

## Data Fetching Patterns

- Server Components fetch from the FastAPI backend through `lib/api/` and validate with Zod.
- Product/category pages are server-rendered or statically generated with revalidation where appropriate.
- Client Components receive already-validated props; avoid unnecessary client-side JavaScript.

---

## SEO, AIO & GEO

Full rules: `docs/SEO-AIO-GEO.md`. Every indexable page provides a unique title, meta description, canonical URL, Open Graph metadata, and breadcrumbs. JSON-LD builders live in `lib/seo/`; `Offer` is emitted only when price/availability are verified.

---

## Styling Guidelines

- Tailwind CSS with design tokens; shadcn/ui primitives for accessible controls.
- Responsive, mobile-first layouts.
- No layout shift from images (explicit dimensions).

---

## Testing Requirements

| Layer | Tool | Coverage |
|---|---|---|
| Components / utils | Vitest + Testing Library | Critical components, SEO builders, API schemas |
| E2E | Playwright | Browse → search → product detail → add to list → "Buy from Oriflame" handoff |

Component tests assert accessible roles/names. E2E tests run against development fixtures or mocked APIs, never live Oriflame.

---

## Accessibility Requirements

- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page.
- Keyboard navigation for filters, menus, dialogs, and the shopping list.
- Visible focus states; sufficient colour contrast.
- Descriptive alt text based on factual product information.

---

## Performance

- Optimise images, minimise client JavaScript, and monitor Core Web Vitals (LCP, INP, CLS).

---

*Frontend AGENT.md — Version 0.1.0 — October 2026*
