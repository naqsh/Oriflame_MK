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
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.3.3 | Utility-first styling |
| shadcn/ui | 4.22.1 | Accessible UI primitives where useful (add with `npx shadcn@4.22.1 add <name>` only when used) |
| Zod | 3.x+ | Runtime schema validation |
| React Hook Form | latest stable | Forms (where appropriate) |
| Vitest + Testing Library | 5.0.5 / 16.3.3 | Component/unit tests |
| Playwright | 1.64.1 | End-to-end tests (config and browsers: OR-007) |

---

## Architecture

```
frontend/
├── AGENT.md                    # This file
├── app/
│   ├── layout.tsx              # Root layout, site-wide metadata, Organization/WebSite JSON-LD
│   ├── page.tsx                # Homepage
│   ├── products/
│   │   ├── page.tsx            # Product listing (filter/sort, paginated)
│   │   └── [slug]/page.tsx     # Product detail page
│   ├── categories/
│   │   └── [slug]/page.tsx     # Category page
│   ├── search/page.tsx         # Search results
│   ├── referral/page.tsx       # How-to-buy / referral handoff
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── status/page.tsx         # Backend status (noindex), request-time BackendStatus
│   ├── admin/                  # Protected admin views
│   ├── sitemap.ts              # XML sitemap
│   └── robots.ts               # robots.txt
├── components/
│   ├── layout/                 # site-header, site-footer (disclaimer), site-shell (landmarks)
│   ├── product/
│   ├── search/
│   ├── filters/
│   ├── referral/
│   └── ui/
├── lib/
│   ├── api/                    # client.ts (fetchJson, ApiError), schemas/, health.ts
│   ├── seo/                    # site.ts (name, description, disclaimer) + later metadata/JSON-LD builders
│   └── utils/                  # cn.ts (shadcn class helper)
├── types/
└── __tests__/                  # Vitest specs (incl. NEXT_PUBLIC_ guard)
```

Adjust structure when useful, but keep modules cohesive and avoid oversized files.

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
