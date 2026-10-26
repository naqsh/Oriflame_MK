# AGENT.md — Oriflame Pakistan Referral Store

## What this file is

This is the root index for the Oriflame Pakistan Referral Store (Single-Vendor MVP).
All engineering standards, domain specs, and workflow rules live in
co-located AGENT.md files alongside the code they govern.

**Mission:** Build a production-minded, single-vendor Oriflame Pakistan product discovery and referral storefront. This is the first version of a future Micro-SaaS, but **do not implement multi-tenancy, vendor management, subscription billing, or multi-vendor features in this phase**.

**Architecture:** Next.js App Router frontend | FastAPI backend | Supabase (PostgreSQL) + Alembic | Claude Code Agents  
**Owner model:** Single vendor — referral/consultant code and referral URL are server-side configuration, never hardcoded  
**Repository:** [naqsh/Oriflame_MK](https://github.com/naqsh/Oriflame_MK) (public, default branch `main`)  
**Version:** 0.1.0 | October 2026

> **Independent storefront:** This site is an independent referral storefront, not the official Oriflame website. Do not imply official affiliation or endorsement unless explicitly authorised. Checkout and fulfilment happen on Oriflame's official platform.

---

## Workflow Rules (read at every session start)

| Rule | Behaviour |
|---|---|
| Token usage | Follow `docs/TOKEN-EFFICIENCY.md` — read before `docs/KICKOFF-PROMPT.md` |
| Inspect first | Inspect the existing repository before making changes. Do not overwrite working code or assume an empty project |
| Plan mode | Required for any epic/task or task with 3+ steps — check `docs/jira-tickets-json/*.json` (when present) and `docs/PLAN.md` |
| Assumptions | Identify missing requirements and state assumptions briefly before implementing |
| Edge cases | Review the `Description` field in `docs/jira-tickets-json/*.json` — implement every item under `EDGE CASES` (`IMPLEMENTATION DETAILS`, `TESTING CRITERIA`, `EDGE CASES` sections per task) |
| Task log | Write plan to `docs/tasks/todo.md` before any implementation |
| Verify plan | Check in before starting — do not build on an unconfirmed plan |
| Small increments | Implement in small, testable increments |
| Subagents | Offload research, exploration, parallel analysis to subagents |
| Lessons review | Read `docs/tasks/lessons.md` at session start before touching code |
| Correction loop | After any user correction: update `docs/tasks/lessons.md` immediately |
| Done gate | Never mark complete without proving it works (tests, logs, diff). Report actual results; do not claim checks passed if they were not run |
| Backend verification gate | Before marking any backend task done, run: `uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest` (see `backend/AGENT.md`) |
| Frontend verification gate | Before marking any frontend task done, run: `npm run lint && npm run typecheck && npm run test && npm run build` in `frontend/` (see `frontend/AGENT.md`) |
| Elegance check | For non-trivial changes: pause and ask "is there a more elegant way?" |
| Bug reports | Fix autonomously — point at logs/errors and resolve without hand-holding |
| Security First | Check `docs/SECURITY.md` before touching config, admin routes, referral handling, or external input |
| Referral config | Referral code/URL come only from server-side configuration via `ReferralService` — never hardcode, never build referral URLs in UI components (see `docs/REFERRAL.md`) |
| Catalogue honesty | Never fabricate products, SKUs, prices, ratings, reviews, stock, or attribution (see `docs/CATALOGUE-DATA.md`) |
| Fixtures | Mock data only in explicitly named development fixtures — never presented as live Oriflame data |
| Single vendor | No tenant tables, vendor management, or billing in this phase — keep code modular for a later multi-tenant phase |
| Migrations | Every schema change ships with an Alembic migration — no undocumented manual schema changes |
| Database | Supabase is the PostgreSQL host only — connect via `POSTGRES_URL`; schema only through Alembic (never the Supabase Table Editor); enable RLS on every new table (see `docs/DATABASE.md`) |
| Dependencies | Keep dependencies lean and explain material additions |
| Ask first | Ask before destructive changes, using paid services, or implementing any checkout/payment integration |
| Env & secrets | Create/update `.env.example`, `.gitignore`, README, and setup instructions; never commit `.env` |
| Knowledge capture | New techniques or non-trivial fixes go in `docs/learning/` |
| Task tracking | Update `docs/tasks/todo.md` and `docs/tasks/lessons.md` on completion |
| Reference standards | Consult `docs/example-code/` before writing new code |
| Clean up | Delete temporary scripts from the root at task completion |
| Json Sync | JSON ticket changes MUST update `docs/PLAN.md` |
| Context checkpoint | At ~75% context, write `docs/tasks/checkpoint.md` and commit WIP |

---

## MVP Delivery Overview

| Milestone | Scope Summary | Status |
|---|---|---|
| **MVP 1** | Project scaffold: Next.js frontend, FastAPI backend, Supabase PostgreSQL + Alembic, typed settings, `.env.example`, CI | ✅ Completed (PR #2) |
| **MVP 2** | Catalogue data: permitted-source investigation, minimal schema, idempotent sync with sync-run records | ⬜ Planned |
| **MVP 3** | Storefront: homepage, listing/category pages, product detail, search, filter/sort, local shopping list | ⬜ Planned |
| **MVP 4** | Referral handoff: `ReferralService`, config provider, host validation, manual-code fallback, click analytics | ⬜ Planned |
| **MVP 5** | SEO, AIO & GEO: metadata, canonical URLs, sitemap, robots.txt, JSON-LD, FAQs/guides, content pages | ⬜ Planned |
| **MVP 6** | Admin & hardening: protected admin area, audit logs, security headers, rate limits, E2E tests, deployment docs | ⬜ Planned |

Acceptance criteria for the whole MVP: `docs/PLAN.md` → **MVP Acceptance Criteria**.

---

## Where to look

| Concern | File | MVP |
|---|---|---|
| Architecture & boundaries | docs/ARCHITECTURE.md | MVP 1 |
| **Database (Supabase)** | docs/DATABASE.md | MVP 1 |
| Engineering Standards (FE/BE/DB) | docs/ENGINEERING-STANDARDS.md | MVP 1 |
| **Run locally** | docs/guidence/try-it-locally.md | MVP 1 |
| Details of epics and tasks | docs/jira-tickets-json/*.json (format — see `docs/jira-tickets-json/README.md`) | MVP 1–6 |
| Catalogue, images & availability | docs/CATALOGUE-DATA.md | MVP 2 |
| Referral configuration & handoff | docs/REFERRAL.md | MVP 4 |
| SEO, AIO & GEO | docs/SEO-AIO-GEO.md | MVP 5 |
| Security | docs/SECURITY.md | MVP 1–6 |
| Observability & analytics | docs/OBSERVABILITY.md | MVP 6 |
| Deployment gates | docs/DEPLOYMENT-GATES.md | MVP 6 |
| Governance & ownership | docs/GOVERNANCE.md | MVP 6 |
| Incident response | docs/INCIDENT-RESPONSE.md | MVP 6 |
| Supply chain security | docs/SUPPLY-CHAIN-SECURITY.md | MVP 1 |
| Final execution rules | docs/EXECUTION-RULES.md | MVP 1 |
| Implementation progress | docs/PLAN.md | MVP 1 |
| Token efficiency (context window) | docs/TOKEN-EFFICIENCY.md | MVP 1 |
| Kick-off prompt | docs/KICKOFF-PROMPT.md | MVP 1 |
| Context checkpoint | docs/tasks/checkpoint.md | MVP 1 |
| Active task plan | docs/tasks/todo.md | MVP 1 |
| Self-improvement log | docs/tasks/lessons.md | MVP 1 |
| Knowledge capture | docs/learning/ | MVP 1 |
| Architectural decisions | docs/adr/ | MVP 1 |
| Reference implementations | docs/example-code/ | MVP 1 |
| Frontend Rules | frontend/AGENT.md | MVP 1 |
| Backend Rules | backend/AGENT.md | MVP 1 |
| CI/CD & Infrastructure | infrastructure/AGENT.md, infrastructure/DEPLOYMENT.md | MVP 1 |

---

## Technology Summary

| Layer | Stack |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui (where useful), Zod, React Hook Form (where appropriate) |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy 2.x, Alembic |
| Database | Supabase (managed PostgreSQL) via `POSTGRES_URL` — see `docs/DATABASE.md` |
| Background jobs / Redis | Only when justified by actual requirements — not part of the MVP by default |

Use compatible stable releases and document the chosen versions in `docs/ENGINEERING-STANDARDS.md`.

---

## Claude Code Agents

| Claude Code Agent | Scope | Rules File | Order |
|---|---|---|---|
| **Coding Agent** | Endpoints, services, storefront pages, referral & catalogue integration | `.claude/rules/coding.md` | 1st |
| **Refactor Agent** | Schema tightness, typing, boundary enforcement, deduplication | `.claude/rules/refactor.md` | 2nd |
| **Testing Agent** | Unit, integration, referral/config, admin-access and E2E tests | `.claude/rules/testing.md` | 3rd |
| **Documentation Agent** | Domain `AGENT.md`, docs, ADRs, learnings | `.claude/rules/docs.md` | 4th |

Epic workflow: branch → implement → refactor → test → docs → PR to `epic/autonomus-implementation` → **merge commit** → delete local epic branch (keep remote). Details in `.claude/rules/coding.md` and `docs/EXECUTION-RULES.md` §9.

---

*Oriflame Pakistan Referral Store — Version 0.1.0 — October 2026*
