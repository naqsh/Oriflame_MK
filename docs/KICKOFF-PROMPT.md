# Kick-off Prompt — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

This document contains the ready-to-use prompt to start autonomous implementation of the Oriflame Pakistan Referral Store.

---

## Pre-Flight Checklist

Before running the kick-off prompt, verify:

- [ ] All documentation files are present in `OriflameMK/`
- [ ] `docs/jira-tickets-json/` contains the epic JSON for the target MVP (create it first if absent — format in `docs/jira-tickets-json/README.md`)
- [ ] `docs/tasks/todo.md` exists and is ready for updates
- [ ] `docs/tasks/lessons.md` exists with initial structure
- [ ] `docs/tasks/checkpoint.md` exists for context handoff
- [ ] `docs/TOKEN-EFFICIENCY.md` exists for context window rules
- [ ] `.claude/rules/` contains all 4 rule files (coding, testing, refactor, docs)
- [ ] Git repository is initialized and `origin` points to `https://github.com/naqsh/Oriflame_MK` (`gh repo clone naqsh/Oriflame_MK` for a fresh checkout)
- [ ] Permitted catalogue source and referral method are known, or the plan uses labelled development fixtures

---

## Kick-off Prompt (Copy This)

```
You are implementing the Oriflame Pakistan Referral Store (single-vendor MVP).

## CRITICAL: Read These Files First (In Order)
1. AGENT.md — Root index with workflow rules
2. docs/TOKEN-EFFICIENCY.md — Context window rules
3. docs/EXECUTION-RULES.md — Execution discipline and context management
4. docs/tasks/checkpoint.md — Current state (starting fresh)
5. docs/PLAN.md — Implementation progress tracker
6. .claude/rules/* — Claude Code rules for coding, testing, refactor, and docs

## Project Overview
- Independent referral storefront for Oriflame Pakistan products (not the official site)
- Next.js App Router frontend + FastAPI backend + Supabase (PostgreSQL)/Alembic
- "Buy from Oriflame" handoff via server-side ReferralService
- No multi-tenancy, vendor management, billing, or on-site checkout in this phase

## Your Mission
Implement Epic OR-E1 (MVP 1: Project Scaffold) following the autonomous workflow:

### Workflow
0. Run environment checks: verify uv, python, node, npm, POSTGRES_URL connectivity to Supabase, and a local test PostgreSQL (TEST_POSTGRES_URL). Fail fast if missing.
1. Inspect the existing repository; do not overwrite working code.
2. Create branch: `git checkout -b epic/E1-project-scaffold`
3. Read all tasks from `docs/jira-tickets-json/OR-E1-*.json`
4. Update `docs/tasks/todo.md` with your implementation plan; state assumptions
5. Implement each task following IMPLEMENTATION DETAILS and EDGE CASES
6. After coding: run Refactor Agent checks
7. After refactor: run Testing Agent checks and VERIFY the suites pass (0 failures)
8. After testing: run Docs Agent updates
9. Update `docs/PLAN.md` with completion status
10. Push branch and open PR to `epic/autonomus-implementation`
11. Merge PR with a **merge commit** after CI passes (not squash or rebase)
12. Pull `epic/autonomus-implementation`; delete **local** epic branch only
13. Start next epic from updated `epic/autonomus-implementation`

### Context Management
- At ~75% context usage, write checkpoint to `docs/tasks/checkpoint.md`
- Commit WIP and document next steps

### Rules
- Plan file modifications before writing code.
- If you encounter the same error 3 times, STOP. Document the blocker in docs/tasks/checkpoint.md and ask the user.
- Referral code/URL only via server-side configuration and ReferralService
- Never fabricate catalogue data; dev mock data only in named fixtures
- Use `uv` for Python, `npm` for Node.js
- Ask before destructive changes, paid services, or any checkout/payment integration

## Start Now
Begin with OR-001. Read the task details from `docs/jira-tickets-json/OR-E1-mvp1-scaffold.json`.
```

---

## Session Continuation Prompt

Use this prompt when resuming from a checkpoint:

```
Continue implementing the Oriflame Pakistan Referral Store.

## CRITICAL: Read These Files First
1. docs/tasks/checkpoint.md — Resume from this state
2. docs/tasks/lessons.md — Any learnings from previous session
3. AGENT.md — Root workflow index
4. docs/TOKEN-EFFICIENCY.md — Context window rules (do NOT re-read KICKOFF-PROMPT)
5. docs/PLAN.md — Current progress
6. docs/EXECUTION-RULES.md — Workflow discipline

## Rules Reminder
- Follow docs/TOKEN-EFFICIENCY.md and docs/EXECUTION-RULES.md
- Update checkpoint.md at 75% context usage
- Commit progress before session end
- Check existing state before overwriting
- Stop and ask for help if stuck on the same error 3 times

## Continue
Resume from the task and step documented in checkpoint.md.
```

---

## Epic-Specific Prompts

### MVP 1: Project Scaffold (OR-E1)
```
Implement Epic OR-E1: Project Scaffold
Branch: epic/E1-project-scaffold
Tasks: OR-001 through OR-009
Focus: FastAPI app skeleton, Pydantic Settings + ConfigProvider, SQLAlchemy/Alembic, Next.js App Router scaffold, .env.example, .gitignore, README, CI
```

### MVP 2: Catalogue Data (OR-E2)
```
Implement Epic OR-E2: Catalogue Data
Branch: epic/E2-catalogue-data
Tasks: OR-010 through OR-017
Focus: Permitted-source ADR, minimal schema + migrations, Oriflame integration client, idempotent sync, sync-run records, dev fixtures
```

### MVP 3: Storefront (OR-E3)
```
Implement Epic OR-E3: Storefront
Branch: epic/E3-storefront
Tasks: OR-018 through OR-028
Focus: Catalogue/search APIs with pagination, homepage, listing/category/PDP/search pages, filters/sort, local shopping list
```

### MVP 4: Referral Handoff (OR-E4)
```
Implement Epic OR-E4: Referral Handoff
Branch: epic/E4-referral-handoff
Tasks: OR-029 through OR-035
Focus: ReferralService, host allow-list, manual-code path + copy action, referral page, click analytics
```

### MVP 5: SEO, AIO & GEO (OR-E5)
```
Implement Epic OR-E5: SEO, AIO & GEO
Branch: epic/E5-seo-aio-geo
Tasks: OR-036 through OR-043
Focus: Metadata, canonical, sitemap, robots, breadcrumbs, Open Graph, JSON-LD, FAQs/guides, about/contact/legal pages
```

### MVP 6: Admin & Hardening (OR-E6)
```
Implement Epic OR-E6: Admin & Hardening
Branch: epic/E6-admin-hardening
Tasks: OR-044 through OR-053
Focus: Admin auth, sync status + manual trigger, referral config status, audit logs, secure headers, rate limits, Playwright E2E, deployment docs
```

---

## Expected First Session Output

By end of first session (or checkpoint), you should have:

1. **Branch created:** `epic/E1-project-scaffold`
2. **Files created:** `pyproject.toml`, `.env.example`, `.gitignore`, `backend/app/main.py`, `backend/app/core/config.py`, `backend/alembic/`, `frontend/` Next.js scaffold, `.github/workflows/ci.yml`
3. **Documentation updated:** `docs/tasks/todo.md`, `docs/PLAN.md`
4. **Checks passing:** backend and frontend verification gates green

---

## Troubleshooting

### "Context is getting long"
Write checkpoint immediately, commit WIP, document next steps clearly.

### "Task is unclear"
Check IMPLEMENTATION DETAILS and EDGE CASES in the JSON file. If still unclear, state the assumption and document it in `docs/adr/`.

### "No permitted catalogue source yet"
Proceed with explicitly named development fixtures; never present them as live data. Record the open decision in `docs/adr/README.md`.

### "Tests are failing"
Fix before proceeding. Never move to next task with failing tests.

---

*Kick-off Prompt — Version 0.1.0 — October 2026*
