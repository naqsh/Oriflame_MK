# ADR-002: Referral Method and Allowed Hosts

**Status:** Proposed (the referral mechanism is not yet confirmed with Oriflame; the handoff ships in restricted mode until it is)
**Date:** 2026-10-27
**Authors:** Claude Code Agent (OR-029), from the owner's instructions

## Context

The "Buy from Oriflame" handoff (OR-E4) must use only an official referral URL or a documented, permitted mechanism (`docs/REFERRAL.md`). OR-029 asks the owner how Oriflame Pakistan attributes referrals.

### Owner confirmation so far

| Question | Answer | Source |
|---|---|---|
| Allowed referral host(s) | `pk.oriflame.com` only, exact match | Owner, OR-002 (2026-10-26) |
| Official referral URL or manual code entry? | **Not confirmed yet.** The owner will add the code or link to the server's `.env` later | Owner, 2026-10-27 |
| Where do checkout and payment happen? | Always on Oriflame's main site; the visitor's items go with them | Owner, 2026-10-27 (`docs/REFERRAL.md`, "Checkout handoff") |
| Link to Oriflame when no referral is configured? | Yes: sending visitors to Oriflame's main site for checkout and payment is the owner's stated requirement | Owner, 2026-10-27 |
| Official way to pre-fill Oriflame's basket? | None known; not assumed | — |

## Decision

1. **Both methods are supported; configuration decides.** `ORIFLAME_REFERRAL_METHOD` selects:
   - `official_url`: the handoff opens `ORIFLAME_REFERRAL_URL`, which must be `https`, on an allowed host, with no credentials, fragment or non-default port. It is checked at startup and again on every resolve.
   - `manual_code`: the handoff shows instructions and a copy action for `ORIFLAME_CONSULTANT_CODE`. Choosing this method is the owner's confirmation that the code may be shown publicly; it never appears in client bundles or `NEXT_PUBLIC_` variables, only in the handoff response.
2. **Restricted mode while not configured.** With no usable referral (empty placeholders, or an invalid URL), the handoff is `unavailable`. It says the purchase continues on Oriflame's official site and links to the site's homepage, built from the allowed host (`https://pk.oriflame.com/`), with **no referral claim**.
3. **Allowed hosts**, matched exactly by `ALLOWED_REFERRAL_HOSTS` in `backend/app/core/config.py` (a test compares the code to this line):

   `ALLOWED_REFERRAL_HOSTS: pk.oriflame.com`

4. **Never assume attribution.** A consultant code is never appended to any URL, the handoff never claims a sale is attributed, and no instruction text promises it.
5. **Items:** the shopping-list handoff shows the items to re-add on Oriflame (names, codes, quantities, official product links when they exist, a copy-list action). The basket is never pre-filled, scripted or scraped.

## Consequences

### Positive
- The owner can switch between a link and a code with one environment variable and a restart, without a code change.
- Visitors always have a working way to buy on Oriflame, even before the referral is configured.

### Negative
- Until the owner configures a referral, purchases may not be attributed to them.
- Re-adding items on Oriflame is manual for visitors.

### Neutral
- Admin status (OR-E6) reports `configured`, `not_configured` or `invalid` without revealing the code.

## Revisit when

- The owner confirms how Oriflame Pakistan attributes referrals (link format, or code entry at checkout). Record it here and set the status to **Accepted**.
- Oriflame documents a basket pre-fill mechanism.

## Alternatives Considered

### Alternative 1: Append the consultant code to Oriflame URLs
- Not a documented mechanism; it may silently fail to attribute. **Rejected** (`docs/REFERRAL.md`).

### Alternative 2: Show nothing until the referral is configured
- Leaves visitors with no way to buy, which contradicts the owner's requirement that checkout continues on Oriflame. **Rejected.**

## References

- `docs/REFERRAL.md`, `docs/SECURITY.md`
- ADR-005 (configuration provider seam)
- OR-029 to OR-035 in `docs/jira-tickets-json/OR-E4-mvp4-referral-handoff.json`
