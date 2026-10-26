# JIRA Tickets JSON Directory — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Purpose

This directory contains JSON exports of epics and tasks that drive the implementation backlog. Claude Code Agents use the structured data here to perform step-by-step implementation with full context of requirements, acceptance criteria, and dependencies.

---

## Directory Structure

```
docs/jira-tickets-json/
├── README.md                              # This file
├── OR-E1-mvp1-scaffold.json               # MVP 1: Project scaffold    (9 tasks:  OR-001–OR-009)
├── OR-E2-mvp2-catalogue-data.json         # MVP 2: Catalogue data      (8 tasks:  OR-010–OR-017)
├── OR-E3-mvp3-storefront.json             # MVP 3: Storefront          (11 tasks: OR-018–OR-028)
├── OR-E4-mvp4-referral-handoff.json       # MVP 4: Referral handoff    (7 tasks:  OR-029–OR-035)
├── OR-E5-mvp5-seo-aio-geo.json            # MVP 5: SEO, AIO & GEO      (8 tasks:  OR-036–OR-043)
└── OR-E6-mvp6-admin-hardening.json        # MVP 6: Admin & hardening   (10 tasks: OR-044–OR-053)
```

**Total: 53 tasks across 6 epics**

Epic scope for each file is defined in `docs/PLAN.md`.

---

## Canonical Task Format (Required for All Epics)

**All epic and task JSON files MUST use the flat-array format** with a rich `Description` column.

```json
{
  "OR-E1": [
    {
      "Issue id": "OR-E1",
      "Summary": "MVP 1: Project Scaffold",
      "Issue Type": "Epic",
      "Description": "Epic scope...\n\nSCOPE:\n...\n\nREFERENCE DOCS:\n...\n\nSUCCESS CRITERIA:\n...",
      "Labels": "mvp1,scaffold",
      "Parent": ""
    },
    {
      "Issue id": "OR-001",
      "Summary": "Typed settings and ConfigProvider",
      "Issue Type": "Task",
      "Description": "One-line summary.\n\nIMPLEMENTATION DETAILS:\n- Bullet list of files and changes\n\nEFFORT: M (8 hours)\nPROJECT AREA: Backend\nDEPENDENCIES: none\n\nTESTING CRITERIA:\n- Measurable pass conditions\n\nEDGE CASES:\n- Failure modes agents must handle",
      "Labels": "backend,config",
      "Parent": "OR-E1"
    }
  ]
}
```

### Description Field Sections (Required per Task)

| Section | Required | Purpose |
|---|---|---|
| Summary line | Yes | One-sentence task goal before sections |
| `IMPLEMENTATION DETAILS` | Yes | Files to create/modify, APIs, config |
| `EFFORT` | Yes | T-shirt size and hours (e.g. `M (8 hours)`) |
| `PROJECT AREA` | Yes | Backend, Frontend, CI/CD, Docs, etc. |
| `DEPENDENCIES` | Yes | Prior task IDs or epic prerequisites |
| `TESTING CRITERIA` | Yes | Tests and measurable acceptance checks |
| `EDGE CASES` | Yes | Fail-safe behaviour — **Coding Agent must implement all** |

Epic entries (`Issue Type: Epic`) use `SCOPE`, `REFERENCE DOCS`, and `SUCCESS CRITERIA` instead of implementation sections.

---

## Backend Verification Gate (Required Before Task Complete)

Before marking any backend task done, run from the repository root:

```bash
uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest
```

Frontend tasks run `npm run lint && npm run typecheck && npm run test && npm run build` in `frontend/`. See `backend/AGENT.md`, `frontend/AGENT.md`, and `AGENT.md` workflow rules.

---

## Workflow Rules

| Rule | Behaviour |
|---|---|
| JSON Sync | When JSON files change, update `docs/PLAN.md` to reflect changes |
| Description format | All epics use the flat-array format with `IMPLEMENTATION DETAILS`, `TESTING CRITERIA`, `EDGE CASES` sections |
| Edge Cases | Coding Agent MUST implement all `EDGE CASES` listed in the task `Description` field |
| Test Requirements | Coding Agent MUST create tests matching `TESTING CRITERIA` |
| Dependencies | Check task dependencies before starting implementation |
| Domain rules | Tasks touching referral, catalogue, or SEO must cite `docs/REFERRAL.md`, `docs/CATALOGUE-DATA.md`, or `docs/SEO-AIO-GEO.md` under REFERENCE DOCS |

---

## Agent Usage

### Claude Code Coding Agent

When assigned a task:

1. **Read the task description** including edge cases
2. **Check dependencies** — ensure prerequisite tasks are done
3. **Implement the feature** following edge case requirements
4. **Create tests** matching `TESTING CRITERIA`
5. **Update** `docs/tasks/todo.md` and `docs/PLAN.md`

### Example Agent Workflow

```
1. Agent reads OR-0xx (ReferralService) from OR-E4-mvp4-referral-handoff.json
2. Sees EDGE CASES: ["Referral URL host not on allow-list — reject", "Config missing — safe message"]
3. Implements ReferralService with both behaviours
4. Creates tests for each edge case
5. Updates docs/tasks/todo.md and docs/PLAN.md
```

---

## Validation

Validate every JSON file parses before commit:

```bash
for f in docs/jira-tickets-json/*.json; do python -c "import json,sys; json.load(open(sys.argv[1]))" "$f" && echo "Valid: $f"; done
```

---

*JIRA Tickets JSON README — Version 0.1.0 — October 2026*
