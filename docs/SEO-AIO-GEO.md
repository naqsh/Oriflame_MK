# SEO, AIO & GEO — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Goal

Apply technical SEO, useful content practices for AI-assisted search (AIO/GEO), accessibility, and performance best practices. SEO/AIO/GEO work must improve clarity and usefulness, **not promise ranking outcomes**.

---

## Implementation Checklist

| Item | Detail | Owner file |
|---|---|---|
| Rendering | Server-rendered or statically generated product/category pages where appropriate | `frontend/app/**` |
| Titles & descriptions | Unique per page | `frontend/lib/seo/` |
| Canonical URLs | Every indexable page | `frontend/lib/seo/` |
| Sitemap | XML sitemap of indexable pages | `frontend/app/sitemap.ts` (planned, OR-037) |
| robots.txt | Disallow admin/private routes | `frontend/app/robots.ts` (planned, OR-037) |
| Breadcrumbs | Visible + internal links | `components/layout/` |
| Open Graph | Title, description, image | `frontend/lib/seo/` |
| Image alt text | Descriptive, based on factual product information | `components/product/` |
| JSON-LD | `Product`, `Offer` (only when price/availability verified), `BreadcrumbList`, `WebSite`, `Organization` where applicable | `frontend/lib/seo/` |
| Locale | Accurate PKR currency and Pakistan-specific content | — |
| Content | Helpful, original FAQs and guides | `app/referral`, `app/about`, guides |

---

## Prohibited

- Fake reviews or ratings
- Unsupported medical/beauty claims
- Misleading availability
- Keyword stuffing
- Mass-generated thin pages
- Implying official Oriflame affiliation or endorsement

---

## Verification

- Validate JSON-LD with a structured-data validator during review.
- Unit-test JSON-LD builders: `Offer` omitted when price/availability unverified.
- Check sitemap and robots.txt in the deploy smoke test (`infrastructure/DEPLOYMENT.md`).
- Monitor Core Web Vitals (`docs/OBSERVABILITY.md`).

---

*SEO, AIO & GEO — Version 0.1.0 — October 2026*
