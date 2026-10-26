# Session Checkpoint — Docs Committed, Ready for OR-E1

**Date:** October 26, 2026  
**Branch:** `main` tracking `origin/main` (github.com/naqsh/Oriflame_MK, **public**)  
**Last commit:** `50c9697` — "docs: add project governance, architecture docs, and MVP epic backlog" (44 files, pushed)  
**Status:** Pre-MVP 1 — documentation, workflow rules and full backlog in place; **no application code yet**

---

## What This Project Is

Single-vendor **Oriflame Pakistan referral storefront**: visitors browse/search/shortlist products, then hand off to the official Oriflame site via the owner's configured referral destination. No multi-tenancy, billing, or on-site checkout. Must never imply official Oriflame affiliation.

- **Frontend:** Next.js App Router, TypeScript, Tailwind, shadcn/ui, Zod
- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic
- **Database:** Supabase PostgreSQL via `POSTGRES_URL` in `.env` (see `docs/DATABASE.md`)

---

## What Was Done This Session

1. Mirrored the governance/doc structure of `D:\Projects\QaiserDev\daily-briefing-main` (applicable parts only — LLM-specific docs skipped). Content came only from the original `Claude.md`, which was split into the `AGENT.md` tree; `CLAUDE.md` is now a pointer.
2. Created all 6 epic JSON files in `docs/jira-tickets-json/` (53 tasks, OR-001..OR-053) and synced `docs/PLAN.md`.
3. Renamed `.cursor/` → `.claude/`; rules are `.claude/rules/{coding,refactor,testing,docs}.md` with `paths:` frontmatter.
4. Switched database docs to **Supabase** + `POSTGRES_URL`; added `docs/DATABASE.md`.
5. Created `.gitignore` (OR-001 spec) — `.env` and `.env.*` ignored except `.env.example` / `.env.production.example`.
6. Connected the folder to `naqsh/Oriflame_MK` (git init, origin, fetch, checkout main).
7. Secret-scanned staged files (0 hits), committed, pushed. Verified `.env` is **not** on the remote.

---

## Key Rules a Continuing Agent Must Follow

| Rule | Detail |
|---|---|
| Read order | `CLAUDE.md` → `AGENT.md` → `docs/tasks/lessons.md` → this file → `docs/KICKOFF-PROMPT.md` |
| Secrets | Repo is public. Never commit `.env`; never print or copy its values anywhere. Secret-scan staged files before every commit |
| Branching | Epic work on `epic/E{n}-{short}` → PR into `epic/autonomus-implementation` (spelling intentional) with a **merge commit**. Integration branch does not exist yet — create it from `origin/main` |
| Supabase | Session pooler/direct on port 5432 only (reject 6543); normalise to `postgresql+psycopg://` + `sslmode=require`; RLS enabled with no policies on every table; Alembic owns schema; tests use `TEST_POSTGRES_URL`, never the hosted project |
| Referral | All logic in `ReferralService`; config via `ConfigProvider` (env in MVP); HTTPS host allow-list; methods `official_url` / `manual_code` |
| Catalogue | No fabricated product data, prices, or availability |
| Gates | Backend: `uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest`. Frontend: `npm run lint && npm run typecheck && npm run test && npm run build` |
| Tickets | Flat-array JSON; each Description has IMPLEMENTATION DETAILS, EFFORT, PROJECT AREA, DEPENDENCIES, TESTING CRITERIA, EDGE CASES |
| Context | Write a checkpoint here at ~75% context |

**Environment:** Windows 11; Git Bash + PowerShell available; `python` is **not** installed (use PowerShell `ConvertFrom-Json` for JSON validation). Perl `s#...#` edits on Markdown containing `##` break — use the Edit tool.

---

## Open Items

| Item | Owner |
|---|---|
| Local `.env` needs manual fixes: remove `[ ]` brackets around the password in `POSTGRES_URL`; delete the stray `POSTGRES_PASSWORD` line that holds a full URL; rotate the DB password if `.env` was ever shared | User |
| Pending ADRs: catalogue data source, referral method, admin auth, hosting (`docs/adr/README.md`) | User decision |
| OR-001 remaining: create `epic/autonomus-implementation` + `epic/E1-...` branches, `.env.example`, scaffolding | Agent — **wait for user go-ahead** |

---

## Next Session

1. Read `docs/tasks/lessons.md`
2. Confirm with the user before starting implementation
3. Follow `docs/KICKOFF-PROMPT.md` to start OR-E1 (`docs/jira-tickets-json/OR-E1-mvp1-scaffold.json`), beginning with OR-001

---

*Checkpoint written October 26, 2026*
