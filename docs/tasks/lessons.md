# Lessons Log — Oriflame Pakistan Referral Store

> **Note:** Update this file immediately after any user correction or mistake discovery.

---

## Lessons — October 2026

| Date | Mistake Pattern | Root Cause | Rule to Prevent Recurrence |
|---|---|---|---|
| — | — | — | — |

---

## Common Pitfalls to Avoid

### Referral
- Never hardcode the consultant code or referral URL — configuration only, via `ReferralService`
- Never build referral URLs in UI components
- Never assume appending a code to an arbitrary URL creates attribution
- Never claim a sale was attributed without Oriflame confirmation
- Never expose the consultant code via `NEXT_PUBLIC_` unless confirmed intentionally public

### Catalogue
- Never fabricate products, SKUs, prices, ratings, reviews, or stock
- Never bypass authentication, anti-bot systems, access restrictions, or rate limits
- Never assume images/content may be republished without confirmed permission
- Never describe stale data as real-time; label unverified availability honestly
- Mock data only in explicitly named development fixtures

### Architecture
- No tenant tables, vendor management, or billing in this phase
- Keep routers/services/repositories/integration/admin boundaries clean
- Every schema change ships with an Alembic migration

### Security
- Admin routes are never publicly accessible
- Never log secrets or sensitive values
- Do not collect payment card details or delivery addresses

### Testing
- Never mark a task complete without test evidence
- Never claim checks passed if they were not run
- Mock external Oriflame sources in CI — never hit real services

### Workflow
- Inspect the repository before changing it; never assume an empty project
- Never implement before the plan is confirmed
- Always update `todo.md` before starting implementation
- Ask before destructive changes, paid services, or checkout/payment integration

---

## Session Log

| Session Date | Key Lessons Learned |
|---|---|
| 2026-10-26 | Documentation structure established from Claude.md spec |

---

*Last Updated: October 2026*
