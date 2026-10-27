# Referral Configuration & Handoff — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Principle

The referral code and referral URL are **configuration, not constants in application source**. The initial owner is one vendor whose Oriflame referral/consultant code and referral URL must be configurable without hardcoding them.

---

## Configuration (MVP: environment variables)

```dotenv
# Backend
POSTGRES_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

# Referral configuration — replace with real, approved values
ORIFLAME_COUNTRY=PK
ORIFLAME_CONSULTANT_CODE=
ORIFLAME_REFERRAL_URL=
ORIFLAME_REFERRAL_METHOD=official_url
```

| Variable | Meaning |
|---|---|
| `ORIFLAME_COUNTRY` | Market (`PK`) |
| `ORIFLAME_CONSULTANT_CODE` | Owner's consultant/referral code — server-side only |
| `ORIFLAME_REFERRAL_URL` | Official referral URL supplied/approved by Oriflame |
| `ORIFLAME_REFERRAL_METHOD` | `official_url` (redirect to referral URL) or `manual_code` (instruct visitor to enter code at checkout) |

### Allowed referral hosts

`ORIFLAME_REFERRAL_URL` must use `https` and its host must exactly match an entry in `ALLOWED_REFERRAL_HOSTS` (`backend/app/core/config.py`). Confirmed with the owner (October 2026):

| Host | Notes |
|---|---|
| `pk.oriflame.com` | Oriflame Pakistan, the only allowed host |

Subdomain wildcards are not allowed, and neither are URLs with embedded credentials. Adding a host is a code change plus an update to this table and to [ADR-002](adr/ADR-002-referral-method.md), made only after the owner confirms it.

**Referral method:** see [ADR-002](adr/ADR-002-referral-method.md) (Proposed). Both `official_url` and `manual_code` are supported by configuration. Until a referral is configured, the handoff runs in **restricted mode**: it links to `https://pk.oriflame.com/` with no referral claim.

### Validation (OR-002)

- `Settings` (Pydantic Settings) loads the variables once; services read them through `ConfigProvider.get_referral_config()` and never from `os.environ`.
- Empty `ORIFLAME_CONSULTANT_CODE` / `ORIFLAME_REFERRAL_URL` are treated as unset. Startup still succeeds, and `ReferralConfig.is_configured` reports `False`.
- `ORIFLAME_REFERRAL_METHOD=manual_code` without `ORIFLAME_CONSULTANT_CODE` fails at startup, and so does an unknown method.
- The consultant code is a `SecretStr`, so it never appears in a repr, a log or a `model_dump`.

---

## Requirements

- Commit `.env.example` only; never commit `.env` or real credentials/codes.
- Add `.env`, local secrets, and generated files to `.gitignore`.
- Load backend configuration through a typed settings class (Pydantic Settings).
- Never expose private environment variables to the browser or use a `NEXT_PUBLIC_` prefix for the consultant code unless it is confirmed to be intentionally public.
- The referral URL may be rendered as a public outbound link when needed, but resolve it on the server and validate its allowed host.
- Do not assume that appending a consultant code to an arbitrary URL creates attribution.
- Use only an official referral URL or a documented, permitted referral mechanism.
- If the official checkout requires manual code entry, show clear instructions and a copy-code action.
- Do not state that a sale was attributed unless Oriflame confirms it.
- Centralise referral handling in a `ReferralService`; do not construct referral URLs in UI components.
- For a future admin-editable setting, define a configuration-provider interface now if it remains lightweight. Environment variables are the initial provider. A future database-backed provider may override them, but do not build a settings database/UI unless requested.

---

## Handoff Flow

Implemented in OR-E4 (ADR-002, **Proposed**: restricted mode until the owner configures a referral).

```mermaid
sequenceDiagram
  participant V as Visitor
  participant FE as BuyFromOriflame (browser)
  participant API as POST /api/v1/referral/handoff
  participant RS as ReferralService
  participant DB as referral_clicks
  V->>FE: Click "Buy from Oriflame"
  FE->>API: {origin, product_slug?, item_count} (no destination field)
  API->>RS: resolve()
  RS->>RS: Read config via ConfigProvider, re-validate URL
  API->>DB: Record anonymous click (best effort; bots skipped)
  alt official_url
    API-->>FE: {method, url, note}
    FE-->>V: New tab to the referral URL (dialog with items, or if the pop-up is blocked)
  else manual_code
    API-->>FE: {method, code, instructions, checkout_url}
    FE-->>V: Dialog: steps, Copy code, items to re-add, link to Oriflame
  else unavailable (restricted mode)
    API-->>FE: {method, reason, message, fallback_url}
    FE-->>V: Dialog: purchase continues on Oriflame, link to https://pk.oriflame.com/
  end
```

| Piece | Where |
|---|---|
| Referral decisions and all visitor text | `backend/app/services/referral.py` (`ReferralService`, `HandoffService`) |
| URL rules (https, allow-listed host, no credentials, fragment or non-default port) | `referral_url_problem` in `backend/app/core/config.py`, at startup and on every resolve |
| Handoff endpoint | `POST /api/v1/referral/handoff` (`extra="forbid"`, item_count 0 to 200, `Cache-Control: no-store`, 30 requests per minute per client) |
| Mode for the how-to-buy page | `GET /api/v1/referral/mode`, which returns the method only (no code or URL, no click) |
| UI | `frontend/components/referral/buy-from-oriflame.tsx`, `copy-text.tsx`, the `/referral` page |

### Click analytics

`referral_clicks` stores only `occurred_at`, `method`, `origin` (`pdp`, `list`, `referral_page`), `product_slug` (NULL when unknown or not a product click) and `item_count`. There is **no IP address, user agent, cookie or other identifier**. Obvious bots (by user agent, inspected and discarded) are not counted, and a failure to record never blocks the handoff. `daily_counts(start, end)` counts by Pakistan-time day for the admin view (OR-E6). Clicks are not sales: nothing here claims attribution.

Copy shown to visitors must state that checkout and fulfilment happen on Oriflame's official platform and must not claim attribution.

### Checkout handoff: items and payment go to Oriflame (owner requirement, 2026-10-27)

When a visitor checks out, **the order, payment and delivery happen on Oriflame's main site** (`pk.oriflame.com`), never here. This site has no checkout, takes no payment and collects no address or card details. "Buy from Oriflame" on a product page and on the shopping list (`/list`) hands the visitor over with the owner's referral (above).

The visitor's items go with them, in the way Oriflame permits:

| Case | What the handoff does |
|---|---|
| Oriflame documents a way to pre-fill its basket (an official cart link or API) | Use it, but only after OR-029 confirms it and ADR-002 records the terms |
| Otherwise (the default) | Open Oriflame with the referral destination and show the list to re-add there: names, product codes, quantities and, for real (non-fixture) products, each item's official product link, plus a "copy list" action |

Never script, automate or scrape Oriflame's basket or checkout, and never send the visitor's list to this site's backend (OR-027 keeps it in the browser). Until a permitted source exists (ADR-001), fixture products have no Oriflame product pages, so the list handoff shows names and quantities only.

The referral code and URL placeholders are in the owner's local `.env` (filled in later); empty values leave the referral "not configured" and the store keeps working.

---

## Admin Visibility

The admin area shows referral **configuration status** (configured / missing / invalid host) and basic click analytics. While configuration is environment-based, do not create a misleading editable form that cannot persist changes — explain that updates are made through deployment environment settings.

---

## Required Tests

- Referral URL generation and host allow-list validation
- `manual_code` path returns instructions and code
- Missing/invalid configuration fails safely
- Consultant code never appears in client bundles or public env

---

*Referral Configuration — Version 0.1.0 — October 2026*
