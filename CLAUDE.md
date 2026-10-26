# CLAUDE.md — Oriflame Pakistan Referral Store

All project rules live in the AGENT.md tree. **Read [`AGENT.md`](AGENT.md) first** — it is the root index and workflow-rule source of truth.

## Session start (read in order)

1. `docs/tasks/checkpoint.md`
2. `docs/tasks/lessons.md`
3. `AGENT.md`
4. `docs/TOKEN-EFFICIENCY.md`
5. `docs/PLAN.md`
6. `docs/EXECUTION-RULES.md`

Fresh autonomous kickoff only: then `docs/KICKOFF-PROMPT.md`.

## Load on demand

| Working on | Read |
|---|---|
| Backend | `backend/AGENT.md` |
| Database (Supabase, `POSTGRES_URL`) | `docs/DATABASE.md` |
| Frontend | `frontend/AGENT.md` |
| CI/CD, deployment | `infrastructure/AGENT.md`, `infrastructure/DEPLOYMENT.md` |
| Referral code/URL, handoff | `docs/REFERRAL.md` |
| Catalogue, images, availability | `docs/CATALOGUE-DATA.md` |
| SEO / AIO / GEO | `docs/SEO-AIO-GEO.md` |
| Security, admin | `docs/SECURITY.md` |

## Non-negotiables

- Single vendor — no multi-tenancy, vendor management, or billing in this phase.
- Independent storefront — never imply official Oriflame affiliation.
- Referral code/URL are server-side configuration via `ReferralService` — never hardcoded.
- Never fabricate products, prices, reviews, stock, availability, or attribution.
- Ask before destructive changes, paid services, or checkout/payment integration.
