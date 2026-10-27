# Truthful structured data: gating Offer and Product (OR-E5)

**Date:** 2026-10 | **Epic:** OR-E5 | **Code:** `frontend/lib/seo/jsonld.ts`

## Problem

Search engines and AI assistants read JSON-LD as statements of fact. A `Product` with an `Offer` says "this can be bought, at this price, and it is in stock". This store cannot verify stock (no source provides it, see `docs/CATALOGUE-DATA.md`), prices are indicative, and development fixtures are not real products. Emitting the usual e-commerce markup would publish claims the store cannot back.

## Pattern

- **Builders return `null` when the data does not justify the type.** `offerJsonLd()` needs a known PKR price *and* a verified availability status; with `not_confirmed` (today, every product) it returns `null` and the `Product` has no `offers`.
- **Fixtures emit no `Product` at all**, are `noindex` and are left out of the sitemap, so placeholder data never reaches an index.
- **Never `aggregateRating` or `Review`.** There are no genuine reviews.
- **Mirror the page.** `FAQPage` is built from the same typed list the page renders; breadcrumbs JSON-LD from the same `Crumb[]` as the visible trail.
- **Organization is the store**, not Oriflame. Oriflame appears only as the product `brand`.
- **One escaping serializer** (`serializeJsonLd`) and one `<JsonLd>` component. Catalogue text is untrusted, and `</script>` in a name must not end the tag.

## Trade-off

Without `Offer`, product pages are not eligible for price-rich results. That is intended: the gate opens automatically once a permitted source verifies availability (ADR-001), with no markup change needed.

## Tests

`frontend/__tests__/seo-jsonld.test.tsx`: Offer is omitted for unverified availability or a missing price, there is no Product for fixtures, there are no ratings, and the escaping is correct. `guides-faq.test.tsx`: FAQPage mirrors the visible FAQ exactly.
