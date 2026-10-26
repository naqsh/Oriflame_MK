# Implementation Plan — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Overview

This document tracks implementation progress across 6 MVPs. Each epic follows the workflow: **implement → refactor → test → docs → merge**. Task-level detail lives in `docs/jira-tickets-json/OR-E*.json` once created; this file must be updated whenever those JSON files change.

---

## Session Start Rules

When resuming a session (user says "hi"), read in this order:

1. `docs/tasks/checkpoint.md`
2. `docs/tasks/lessons.md`
3. **`AGENT.md`** — root workflow index
4. **`docs/TOKEN-EFFICIENCY.md`** — context window rules
5. `docs/PLAN.md` — this file
6. `docs/EXECUTION-RULES.md`

Fresh autonomous kickoff only (not every "hi"): then read `docs/KICKOFF-PROMPT.md`.

---

## Status Legend

| Symbol | Status |
|---|---|
| ⬜ | Planned |
| 🔄 | In Progress |
| ✅ | Completed |
| 🚫 | Blocked |

---

## MVP 1: Project Scaffold ✅

**Epic:** OR-E1  
**Branch:** `epic/E1-project-scaffold` (PR [naqsh/Oriflame_MK#2](https://github.com/naqsh/Oriflame_MK/pull/2) into `epic/autonomus-implementation`)  
**Tasks:** 9 — `docs/jira-tickets-json/OR-E1-mvp1-scaffold.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-001 | Repository init: git hygiene, env template, tooling pins | Repository / Tooling | S | — | ✅ | Coding |
| OR-002 | Typed settings and ConfigProvider interface | Backend | M | OR-001 | ✅ | Coding |
| OR-003 | FastAPI application skeleton with layered structure | Backend | M | OR-002 | ✅ | Coding |
| OR-004 | SQLAlchemy 2.x session and Alembic initialisation | Backend / Database | M | OR-002 | ✅ | Coding |
| OR-005 | Next.js App Router frontend scaffold | Frontend | M | OR-001 | ✅ | Coding |
| OR-006 | Typed API client and frontend-backend connectivity | Frontend / Backend | S | OR-003, OR-005 | ✅ | Coding |
| OR-007 | Test harnesses: pytest, Vitest, Playwright | Testing | M | OR-003, OR-004, OR-005 | ✅ | Coding |
| OR-008 | GitHub Actions CI pipeline | CI/CD | M | OR-007 | ✅ | Coding |
| OR-009 | Documentation sync for scaffold | Docs | S | OR-001–OR-008 | ✅ | Docs |

---

## MVP 2: Catalogue Data 🔄

**Epic:** OR-E2  
**Branch:** `epic/E2-catalogue-data`  
**Tasks:** 8 — `docs/jira-tickets-json/OR-E2-mvp2-catalogue-data.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-010 | Investigate permitted catalogue sources and record ADR-001 | Docs / Research | M | OR-E1 | ✅ | Coding |
| OR-011 | Catalogue schema models and migration | Backend / Database | M | OR-004, OR-010 | ✅ | Coding |
| OR-012 | Catalogue repositories with idempotent upserts | Backend | M | OR-011 | ⬜ | Coding |
| OR-013 | Replaceable Oriflame source adapter | Backend / Integration | M | OR-010, OR-002 | ⬜ | Coding |
| OR-014 | Catalogue sync service with run recording and safe retries | Backend | M | OR-012, OR-013 | ⬜ | Coding |
| OR-015 | Explicitly named development fixtures | Backend / Fixtures | S | OR-013 | ⬜ | Coding |
| OR-016 | Catalogue sync command-line entry point | Backend / Ops | S | OR-014, OR-015 | ⬜ | Coding |
| OR-017 | Documentation sync for catalogue data | Docs | S | OR-010–OR-016 | ⬜ | Docs |

---

## MVP 3: Storefront ⬜

**Epic:** OR-E3  
**Branch:** `epic/E3-storefront`  
**Tasks:** 11 — `docs/jira-tickets-json/OR-E3-mvp3-storefront.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-018 | Products API: listing with filter/sort/pagination and product detail | Backend | M | OR-E2 | ⬜ | Coding |
| OR-019 | Categories API | Backend | S | OR-018 | ⬜ | Coding |
| OR-020 | Search API with PostgreSQL full-text search | Backend / Database | M | OR-018 | ⬜ | Coding |
| OR-021 | Availability service and honest labels | Backend | S | OR-018 | ⬜ | Coding |
| OR-022 | Frontend catalogue schemas and product components | Frontend | M | OR-018, OR-019, OR-021 | ⬜ | Coding |
| OR-023 | Homepage | Frontend | M | OR-022 | ⬜ | Coding |
| OR-024 | Product listing and category pages with filters and sorting | Frontend | M | OR-022 | ⬜ | Coding |
| OR-025 | Product detail page | Frontend | M | OR-022, OR-021 | ⬜ | Coding |
| OR-026 | Search results page | Frontend | S | OR-020, OR-022 | ⬜ | Coding |
| OR-027 | Local shopping list | Frontend | M | OR-025 | ⬜ | Coding |
| OR-028 | Documentation sync for storefront | Docs | S | OR-018–OR-027 | ⬜ | Docs |

---

## MVP 4: Referral Handoff ⬜

**Epic:** OR-E4  
**Branch:** `epic/E4-referral-handoff`  
**Tasks:** 7 — `docs/jira-tickets-json/OR-E4-mvp4-referral-handoff.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-029 | Confirm referral mechanism and record ADR-002 | Docs / Research | S | OR-002 | ⬜ | Coding |
| OR-030 | ReferralService | Backend | M | OR-029 | ⬜ | Coding |
| OR-031 | Referral click storage | Backend / Database | S | OR-030 | ⬜ | Coding |
| OR-032 | Handoff API endpoint | Backend | S | OR-030, OR-031 | ⬜ | Coding |
| OR-033 | BuyFromOriflame and CopyReferralCode components | Frontend | M | OR-032, OR-025, OR-027 | ⬜ | Coding |
| OR-034 | Referral / how-to-buy page | Frontend / Content | S | OR-033 | ⬜ | Coding |
| OR-035 | Documentation sync for referral handoff | Docs | S | OR-029–OR-034 | ⬜ | Docs |

---

## MVP 5: SEO, AIO & GEO ⬜

**Epic:** OR-E5  
**Branch:** `epic/E5-seo-aio-geo`  
**Tasks:** 8 — `docs/jira-tickets-json/OR-E5-mvp5-seo-aio-geo.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-036 | Metadata builders: titles, descriptions, canonical, Open Graph | Frontend | M | OR-E3 | ⬜ | Coding |
| OR-037 | XML sitemap and robots.txt | Frontend | S | OR-036 | ⬜ | Coding |
| OR-038 | Breadcrumbs and internal linking | Frontend | S | OR-036 | ⬜ | Coding |
| OR-039 | JSON-LD builders: Product, Offer, WebSite, Organization | Frontend | M | OR-036, OR-021 | ⬜ | Coding |
| OR-040 | About, contact, privacy, terms, and cookie pages | Frontend / Content | M | OR-036 | ⬜ | Coding |
| OR-041 | Original FAQs and buying guides | Content / Frontend | M | OR-040 | ⬜ | Coding |
| OR-042 | Performance and Core Web Vitals | Frontend / Performance | M | OR-E3 | ⬜ | Coding |
| OR-043 | Documentation sync for SEO, AIO & GEO | Docs | S | OR-036–OR-042 | ⬜ | Docs |

---

## MVP 6: Admin & Hardening ⬜

**Epic:** OR-E6  
**Branch:** `epic/E6-admin-hardening`  
**Tasks:** 10 — `docs/jira-tickets-json/OR-E6-mvp6-admin-hardening.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-044 | Admin authentication (ADR-003) and admin users | Backend / Frontend / Security | L | OR-E1 | ⬜ | Coding |
| OR-045 | Admin authorisation dependency and CSRF protection | Backend / Frontend / Security | M | OR-044 | ⬜ | Coding |
| OR-046 | Audit logging for admin actions | Backend / Frontend | S | OR-045 | ⬜ | Coding |
| OR-047 | Catalogue sync status and manual sync trigger | Backend / Frontend | M | OR-046, OR-E2 | ⬜ | Coding |
| OR-048 | Product visibility and featured selection (if required) | Backend / Frontend | M | OR-046 | ⬜ | Coding |
| OR-049 | Referral configuration status and click analytics | Backend / Frontend | M | OR-045, OR-E4 | ⬜ | Coding |
| OR-050 | Security headers, CORS verification, and rate limits | Backend / Frontend / Security | M | OR-044 | ⬜ | Coding |
| OR-051 | Playwright end-to-end tests for critical journeys | Testing | M | OR-047, OR-049, OR-050 | ⬜ | Testing |
| OR-052 | Deployment readiness: gates, production env template, deployment docs | Infrastructure / Docs | M | OR-051 | ⬜ | Coding |
| OR-053 | MVP acceptance review | QA / Docs | M | OR-044–OR-052 | ⬜ | Docs |

---

## MVP Acceptance Criteria

The MVP is complete when:

- [ ] The site runs locally using documented commands.
- [ ] Frontend and FastAPI backend communicate successfully.
- [ ] PostgreSQL schema is managed by Alembic.
- [ ] Product catalogue pages work with authorised data or clearly labelled development fixtures.
- [ ] Search, category browsing, and product details work.
- [ ] Referral configuration is read from server-side environment variables.
- [ ] The "Buy from Oriflame" flow uses a validated, configured official referral destination or provides manual-code instructions.
- [ ] No claim of live availability or attributed sales is made without confirmation.
- [ ] SEO metadata, sitemap, robots.txt, and applicable structured data are implemented.
- [ ] Admin functions are protected.
- [ ] `.env` secrets are not committed or exposed to the browser.
- [ ] Setup, configuration, testing, and deployment instructions are documented.
- [ ] The code is organised so a later multi-tenant phase can introduce tenant-aware configuration without rewriting core catalogue or referral services.

---

## Summary

| MVP | Epic | Tasks | Completed | Status |
|---|---|---|---|---|
| MVP 1 | OR-E1 | 9 | 9 | ✅ |
| MVP 2 | OR-E2 | 8 | 0 | ⬜ |
| MVP 3 | OR-E3 | 11 | 0 | ⬜ |
| MVP 4 | OR-E4 | 7 | 0 | ⬜ |
| MVP 5 | OR-E5 | 8 | 0 | ⬜ |
| MVP 6 | OR-E6 | 10 | 0 | ⬜ |
| **Total** | **6 Epics** | **53** | **0** | **0%** |

---

## Workflow Reminder

For each epic:

1. **Create branch** from latest `epic/autonomus-implementation`: `git checkout -b epic/E{n}-{description}`
2. **Implement:** Coding Agent executes all tasks
3. **Refactor:** Refactor Agent reviews and improves
4. **Test:** Testing Agent adds coverage
5. **Document:** Docs Agent updates AGENT.md files
6. **Push & PR:** Push epic branch; open PR to `epic/autonomus-implementation`
7. **Merge:** Use a **merge commit** after CI passes (not squash or rebase)
8. **Post-merge git:** Pull integration branch; delete **local** epic branch only — keep remote epic branch on GitHub
9. **Next epic:** Branch E{n+1} from updated `epic/autonomus-implementation`

---

*Implementation Plan — Version 0.1.0 — October 2026*
