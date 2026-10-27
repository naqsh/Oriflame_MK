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

## MVP 2: Catalogue Data ✅

**Epic:** OR-E2  
**Branch:** `epic/E2-catalogue-data`  
**Tasks:** 8 — `docs/jira-tickets-json/OR-E2-mvp2-catalogue-data.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-010 | Investigate permitted catalogue sources and record ADR-001 | Docs / Research | M | OR-E1 | ✅ | Coding |
| OR-011 | Catalogue schema models and migration | Backend / Database | M | OR-004, OR-010 | ✅ | Coding |
| OR-012 | Catalogue repositories with idempotent upserts | Backend | M | OR-011 | ✅ | Coding |
| OR-013 | Replaceable Oriflame source adapter | Backend / Integration | M | OR-010, OR-002 | ✅ | Coding |
| OR-014 | Catalogue sync service with run recording and safe retries | Backend | M | OR-012, OR-013 | ✅ | Coding |
| OR-015 | Explicitly named development fixtures | Backend / Fixtures | S | OR-013 | ✅ | Coding |
| OR-016 | Catalogue sync command-line entry point | Backend / Ops | S | OR-014, OR-015 | ✅ | Coding |
| OR-017 | Documentation sync for catalogue data | Docs | S | OR-010–OR-016 | ✅ | Docs |

---

## MVP 3: Storefront ✅

**Epic:** OR-E3  
**Branch:** `epic/E3-storefront`  
**Tasks:** 11 — `docs/jira-tickets-json/OR-E3-mvp3-storefront.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-018 | Products API: listing with filter/sort/pagination and product detail | Backend | M | OR-E2 | ✅ | Coding |
| OR-019 | Categories API | Backend | S | OR-018 | ✅ | Coding |
| OR-020 | Search API with PostgreSQL full-text search | Backend / Database | M | OR-018 | ✅ | Coding |
| OR-021 | Availability service and honest labels | Backend | S | OR-018 | ✅ | Coding |
| OR-022 | Frontend catalogue schemas and product components | Frontend | M | OR-018, OR-019, OR-021 | ✅ | Coding |
| OR-023 | Homepage | Frontend | M | OR-022 | ✅ | Coding |
| OR-024 | Product listing and category pages with filters and sorting | Frontend | M | OR-022 | ✅ | Coding |
| OR-025 | Product detail page | Frontend | M | OR-022, OR-021 | ✅ | Coding |
| OR-026 | Search results page | Frontend | S | OR-020, OR-022 | ✅ | Coding |
| OR-027 | Local shopping list | Frontend | M | OR-025 | ✅ | Coding |
| OR-028 | Documentation sync for storefront | Docs | S | OR-018–OR-027 | ✅ | Docs |

---

## MVP 4: Referral Handoff ✅

**Epic:** OR-E4  
**Branch:** `epic/E4-referral-handoff`  
**Tasks:** 7 — `docs/jira-tickets-json/OR-E4-mvp4-referral-handoff.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-029 | Confirm referral mechanism and record ADR-002 | Docs / Research | S | OR-002 | ✅ | Coding |
| OR-030 | ReferralService | Backend | M | OR-029 | ✅ | Coding |
| OR-031 | Referral click storage | Backend / Database | S | OR-030 | ✅ | Coding |
| OR-032 | Handoff API endpoint | Backend | S | OR-030, OR-031 | ✅ | Coding |
| OR-033 | BuyFromOriflame and CopyReferralCode components | Frontend | M | OR-032, OR-025, OR-027 | ✅ | Coding |
| OR-034 | Referral / how-to-buy page | Frontend / Content | S | OR-033 | ✅ | Coding |
| OR-035 | Documentation sync for referral handoff | Docs | S | OR-029–OR-034 | ✅ | Docs |

---

## MVP 5: SEO, AIO & GEO ✅

**Epic:** OR-E5  
**Branch:** `epic/E5-seo-aio-geo`  
**Tasks:** 8 — `docs/jira-tickets-json/OR-E5-mvp5-seo-aio-geo.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-036 | Metadata builders: titles, descriptions, canonical, Open Graph | Frontend | M | OR-E3 | ✅ | Coding |
| OR-037 | XML sitemap and robots.txt | Frontend | S | OR-036 | ✅ | Coding |
| OR-038 | Breadcrumbs and internal linking | Frontend | S | OR-036 | ✅ | Coding |
| OR-039 | JSON-LD builders: Product, Offer, WebSite, Organization | Frontend | M | OR-036, OR-021 | ✅ | Coding |
| OR-040 | About, contact, privacy, terms, and cookie pages | Frontend / Content | M | OR-036 | ✅ | Coding |
| OR-041 | Original FAQs and buying guides | Content / Frontend | M | OR-040 | ✅ | Coding |
| OR-042 | Performance and Core Web Vitals | Frontend / Performance | M | OR-E3 | ✅ | Coding |
| OR-043 | Documentation sync for SEO, AIO & GEO | Docs | S | OR-036–OR-042 | ✅ | Docs |

---

## MVP 6: Admin & Hardening ✅ (with exceptions; see MVP Acceptance Criteria)

**Epic:** OR-E6  
**Branch:** `epic/E6-admin-hardening`  
**Tasks:** 10 — `docs/jira-tickets-json/OR-E6-mvp6-admin-hardening.json`

| Task ID | Summary | Area | Effort | Depends on | Status | Agent |
|---|---|---|---|---|---|---|
| OR-044 | Admin authentication (ADR-003) and admin users | Backend / Frontend / Security | L | OR-E1 | ✅ | Coding |
| OR-045 | Admin authorisation dependency and CSRF protection | Backend / Frontend / Security | M | OR-044 | ✅ | Coding |
| OR-046 | Audit logging for admin actions | Backend / Frontend | S | OR-045 | ✅ | Coding |
| OR-047 | Catalogue sync status and manual sync trigger | Backend / Frontend | M | OR-046, OR-E2 | ✅ | Coding |
| OR-048 | Product visibility and featured selection (if required) | Backend / Frontend | M | OR-046 | ✅ (not needed) | Coding |
| OR-049 | Referral configuration status and click analytics | Backend / Frontend | M | OR-045, OR-E4 | ✅ | Coding |
| OR-050 | Security headers, CORS verification, and rate limits | Backend / Frontend / Security | M | OR-044 | ✅ | Coding |
| OR-051 | Playwright end-to-end tests for critical journeys | Testing | M | OR-047, OR-049, OR-050 | ✅ | Testing |
| OR-052 | Deployment readiness: gates, production env template, deployment docs | Infrastructure / Docs | M | OR-051 | ✅ (deploy exercise open) | Coding |
| OR-053 | MVP acceptance review | QA / Docs | M | OR-044–OR-052 | ✅ | Docs |

---

## MVP Acceptance Criteria

The MVP is complete when (reviewed 2026-10-27 in OR-053: **complete with exceptions**, each listed below and in `docs/tasks/todo.md`):

- [x] The site runs locally using documented commands. *Evidence: `docs/guidence/try-it-locally.md`; every epic was run with these commands (backend `uvicorn --factory`, frontend `next dev` / `next start`); Playwright starts both from `playwright.config.ts`.*
- [x] Frontend and FastAPI backend communicate successfully. *Evidence: Playwright `browse-to-handoff.spec.ts` (catalogue, search, handoff POST) and `admin-protection.spec.ts` (Server Actions → admin API), 7/7 with a database.*
- [x] PostgreSQL schema is managed by Alembic. *Evidence: migrations 001 to 007; `test_migrations.py` (upgrade on an empty DB, downgrade base/-1, RLS on every table); `alembic check` clean; CI step on a fresh DB.*
- [x] Product catalogue pages work with authorised data or clearly labelled development fixtures. *Evidence: development fixtures only (ADR-001 Proposed), with the "Development data" notice; fixture products are noindex, out of the sitemap and emit no Product JSON-LD. **Exception:** no authorised data source exists yet (owner).*
- [x] Search, category browsing, and product details work. *Evidence: API tests (`test_products_api.py`, `test_categories_api.py`, `test_search_api.py`) and the Playwright journey.*
- [x] Referral configuration is read from server-side environment variables. *Evidence: `ConfigProvider`/`Settings` only (no `os.environ` elsewhere); `test_config.py`, `test_referral.py`; the frontend source-hygiene test and a scan of `.next/static` find no code, URL or Oriflame host.*
- [x] The "Buy from Oriflame" flow uses a validated, configured official referral destination or provides manual-code instructions. *Evidence: `ReferralService` (https + allow-listed host, re-checked per resolve), `test_referral.py`, `test_referral_handoff_api.py`, `referral.test.tsx`; Playwright asserts the destination host. **Exception:** no real referral value is configured yet, so the store runs in restricted mode (ADR-002 Proposed; owner).*
- [x] No claim of live availability or attributed sales is made without confirmation. *Evidence: every product shows "Availability not confirmed"; no Offer JSON-LD; referral text tests reject attribution wording; admin analytics are labelled "handoff clicks, not sales" (`admin-sync-referral.test.tsx`).*
- [x] SEO metadata, sitemap, robots.txt, and applicable structured data are implemented. *Evidence: OR-E5 (`docs/SEO-AIO-GEO.md`). **Exception:** external structured-data validation needs a public URL.*
- [x] Admin functions are protected. *Evidence: router-level `require_admin`; `test_admin_access.py` enumerates every admin route (401 without a valid session); lockout and rate limit (`test_admin_auth.py`); Playwright redirect, direct-API 401 and cookie-flag checks.*
- [x] `.env` secrets are not committed or exposed to the browser. *Evidence (2026-10-27): `git log --all` never contains `.env`; a history scan for credential patterns finds only placeholders, local test-database credentials and fake test values; the only `NEXT_PUBLIC_` variable is the API base URL; the production client bundle contains no referral variable, code, Oriflame host or admin cookie name.*
- [x] Setup, configuration, testing, and deployment instructions are documented. *Evidence: README, `docs/guidence/try-it-locally.md`, `.env.example`, `.env.production.example`, `infrastructure/DEPLOYMENT.md`, `docs/DEPLOYMENT-GATES.md`. **Exception:** a fresh deployment and rollback have not been exercised; they need the hosting choice (ADR-004 Proposed).*
- [x] The code is organised so a later multi-tenant phase can introduce tenant-aware configuration without rewriting core catalogue or referral services. *Evidence: services take a `ConfigProvider` (ADR-005); the catalogue source is selected by configuration behind `CatalogueSource`; no tenant constants in repositories. **Known single-country assumption:** the restricted-mode fallback URL and the referral host allow-list are constants (`services/referral.py`, `core/config.py`); a tenant phase moves them into `ReferralConfig`, a local change.*

---

## Summary

| MVP | Epic | Tasks | Completed | Status |
|---|---|---|---|---|
| MVP 1 | OR-E1 | 9 | 9 | ✅ |
| MVP 2 | OR-E2 | 8 | 8 | ✅ |
| MVP 3 | OR-E3 | 11 | 11 | ✅ |
| MVP 4 | OR-E4 | 7 | 7 | ✅ |
| MVP 5 | OR-E5 | 8 | 8 | ✅ |
| MVP 6 | OR-E6 | 10 | 10 | ✅ |
| **Total** | **6 Epics** | **53** | **53** | **100%** (OR-048 closed as not needed; OR-052 deploy exercise open) |

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
