# FINAL EXECUTION RULES — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

This document serves as the absolute source of truth for execution standards and workflow discipline. It supersedes any generalized instructions and applies to all Claude Code Agents working on this project.

---

## 1. Production-Ready Code Requirements

- **No Pseudo-code**: All implementations must be fully functioning code. Comments like `// add logic here` are strictly forbidden unless part of a defined scaffolding step.
- **No Auto-apply Magic**: Developers and agents must verify code before committing.
- **No Fabricated Data**: Never fabricate products, SKUs, prices, ratings, reviews, stock, availability, or referral attribution. Metrics must be wired to real measurements.
- **No Untyped APIs**: All API inputs and outputs must be strictly typed using Pydantic v2 (Backend) and Zod/TypeScript (Frontend).
- **No Hardcoded Secrets or Referral Values**: Credentials, consultant code, and referral URL are injected via environment variables at runtime, validated by `pydantic-settings`.
- **No Referral Logic Outside `ReferralService`**: UI components never construct referral URLs.
- **No Multi-Tenancy Yet**: Do not implement tenant tables, vendor management, subscription billing, or multi-vendor features in this phase.

---

## 2. Workflow Execution Rules (The "ReAct" Loop for Coding)

### MUST Do:

1. **Inspect First**: Inspect the existing repository before making changes. Do not overwrite working code or assume an empty project.
2. **State Assumptions**: Identify missing requirements and state assumptions briefly.
3. **Plan Mode**: Any task with 3 or more steps, or involving architectural decisions, must begin with a written, concise implementation plan — presented before large changes.
4. **Task Logging**: The plan must be written to `docs/tasks/todo.md` before any implementation code is touched.
5. **Small Increments**: Implement in small, testable increments.
6. **Verification Gate**: Do not proceed to the next step on `docs/tasks/todo.md` until the current step is proven to work. **Backend tasks** must pass:

   ```bash
   uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest
   ```

   **Frontend tasks** must pass (from `frontend/`):

   ```bash
   npm run lint && npm run typecheck && npm run test && npm run build
   ```

7. **Honest Reporting**: Run available linting, type checks, tests, and builds. Report actual results; do not claim checks passed if they were not run.
8. **Project Hygiene**: Create or update `.env.example`, `.gitignore`, README, and setup instructions.
9. **Migrations**: Add database migrations; do not rely on undocumented manual schema changes.
10. **Fixtures Only for Mock Data**: Do not insert fake production catalogue data. If mock data is needed for UI development, isolate it in an explicitly named development fixture and never present it as live Oriflame data.
11. **Lean Dependencies**: Keep dependencies lean and explain material additions.
12. **Ask First**: Ask before making destructive changes, using paid services, or implementing a checkout/payment integration.
13. **Lessons Review**: At the start of every session, read `docs/tasks/lessons.md` to avoid repeating past mistakes.
14. **Correction Loop**: If a mistake is made or corrected by a user, immediately update `docs/tasks/lessons.md` with the root cause and a new rule.
15. **Done Gate**: Never mark a task as complete without providing proof (e.g., test output, build success logs, diffs).
16. **Elegance Check**: Before finalizing a complex change, pause and ask: *"Is there a more elegant, standard way to do this?"*
17. **Bug Fix Autonomy**: When encountering a bug during development, analyze the stack trace or logs and fix it autonomously without requiring human hand-holding.
18. **Reference Standards**: Always consult `docs/example-code/` for reference implementations before writing new code.
19. **Edge Case Implementation**: When implementing an epic or task, read the `Description` field of the relevant `.json` file in `docs/jira-tickets-json/` and explicitly implement all edge cases, fail-safes, or fallbacks mentioned.
20. **Security First**: Always check `docs/SECURITY.md` before touching configuration, admin routes, referral handling, or external input.
21. **Knowledge Capture**: When introducing a new technique, fixing a non-trivial bug, or changing patterns, update or create a `.md` file in `docs/learning/`.
22. **Token Efficiency**: Follow `docs/TOKEN-EFFICIENCY.md` at every session start — before `docs/KICKOFF-PROMPT.md`.

### MUST NOT Do:

- Implement before plan confirmed
- Mark done without evidence
- Apply hacky fixes
- Edit out-of-scope files
- Repeat documented mistakes
- Bypass authentication, anti-bot systems, access restrictions, or rate limits of any source
- Copy or republish product images/content without confirmed permission
- Collect payment card details or delivery addresses
- Claim live availability or attributed sales without confirmation
- Imply official Oriflame affiliation or endorsement
- Re-read `docs/KICKOFF-PROMPT.md` on continuation sessions (see `docs/TOKEN-EFFICIENCY.md`)
- Load full codebase or all epic JSON files when checkpoint + current task JSON suffice

---

## 3. Domain-Specific Execution Rules

### Referral Handling

| Condition | Action |
|---|---|
| Referral URL host not on allow-list | Reject at startup/config load; admin status shows invalid |
| `ORIFLAME_REFERRAL_METHOD=manual_code` | Return instructions + copy-code; no URL manipulation |
| Config missing | Handoff shows safe "unavailable" message; never fall back to a guessed URL |
| Attribution | Never claim a sale was attributed without Oriflame confirmation |

### Catalogue Synchronisation

| Condition | Action | Retry |
|---|---|---|
| Source timeout | Record failure on sync run | Yes, with backoff |
| Source access denied / terms changed | Record failure; stop; raise for review | Never automatically |
| Duplicate source id | Upsert (update in place) | — |
| Missing availability | Label "Availability not confirmed" | — |

### Admin

- All admin endpoints require authentication and authorisation.
- Environment-based settings are shown as status, never as a non-persisting editable form.
- Meaningful admin actions are written to `audit_logs`.

---

## 4. YOLO Mode Exceptions & Rules

Even when the user explicitly triggers "YOLO mode" (authorizing high-velocity, low-ceremony implementation without pre-approval gates), the fundamental system rules **still apply**:

1. **Never Skip the Logs**: You must STILL update `docs/tasks/todo.md` to reflect the work done.
2. **Never Forget Lessons**: You must STILL read and append to `docs/tasks/lessons.md`.
3. **No Broken Windows**: YOLO mode does NOT authorize submitting broken, unverified, or pseudo-code.
4. **Immediate Sync**: After completing a YOLO burst, immediately synchronize state into `todo.md` and `lessons.md`.
5. **Never Skip Security or Honesty Rules**: YOLO mode does NOT authorize hardcoding referral values, fabricating catalogue data, or exposing admin routes.

---

## 5. Tech Stack Best Practices

### Backend (Python 3.12+)

- **Package Manager**: Use `uv` exclusively
- **Validation**: Pydantic v2; strict models for external input
- **ORM**: SQLAlchemy 2.x typed declarative models; parameterised queries only
- **Migrations**: Alembic for every schema change
- **HTTP Status**: ALWAYS use `fastapi.status` constants
- **Logging**: `structlog` JSON output with request id; never log secrets
- **Outbound HTTP**: `httpx` with explicit timeouts
- **Typing**: `uv run mypy backend` must pass with zero errors
- **Linting**: `uv run ruff check backend` must pass with zero warnings
- **Tests**: `uv run pytest` must pass before any backend task is marked complete

### Frontend (TypeScript / Next.js App Router)

- **Components**: Server Components by default; Client Components only for interactive UI
- **Validation**: Zod schemas for all API responses and forms (React Hook Form where appropriate)
- **Styling**: Tailwind CSS; shadcn/ui where useful
- **Images**: Next.js image optimisation; authorised assets only
- **Accessibility**: Semantic HTML, accessible controls, keyboard support

---

## 6. Testing Requirements

| Layer | Tool | Coverage |
|---|---|---|
| Backend Unit | pytest | 80% minimum |
| Backend Integration | pytest + httpx + PostgreSQL | Critical paths |
| Backend Security | Access-control tests | All admin endpoints |
| Frontend Unit | Vitest | 75% minimum |
| Frontend E2E | Playwright | Critical customer journeys (where practical) |

### Mandatory Test Categories

- [ ] Referral URL generation and host validation
- [ ] Tenant-independent single-vendor configuration
- [ ] Catalogue upsert idempotency and sync-failure recording
- [ ] API validation and pagination bounds
- [ ] Admin access control
- [ ] Critical customer journey (browse → product → handoff)

---

## 7. Documentation Sync Rules

| Trigger | Action |
|---|---|
| JSON ticket file changed | Update `docs/PLAN.md` |
| New domain directory | Create `AGENT.md` in that directory |
| Env variable added/changed | Update `.env.example`, `docs/REFERRAL.md` or `docs/ENGINEERING-STANDARDS.md`, `infrastructure/DEPLOYMENT.md` |
| Schema change | Alembic migration + `backend/AGENT.md` data model table |
| Bug fixed | Update `docs/tasks/lessons.md` |
| Task completed | Update `docs/tasks/todo.md` |
| New pattern introduced | Create file in `docs/learning/` |
| Architectural decision | Create ADR in `docs/adr/` |

---

## 8. Context Management Rules

### Context Checkpoint Protocol

When context usage reaches ~75%, checkpoint progress and prepare for session handoff.

#### Trigger
- Context window approaching 75% capacity
- Long-running epic with many tasks
- Complex implementation requiring multiple sessions

#### Checkpoint Process

1. **Write checkpoint to `docs/tasks/checkpoint.md`:**

```markdown
# Session Checkpoint — [Epic ID] — [Timestamp]

## Current State
- **Epic:** OR-E{n}
- **Branch:** epic/E{n}-{description}
- **Current Task:** OR-{nnn}
- **Task Status:** [in_progress|blocked|ready_for_next]

## Completed This Session
- [x] OR-001: Task summary

## In Progress
- [ ] OR-002: What was done, what remains

## Files Modified
- path/to/file.py — description of changes

## Decisions Made
- Decision 1: Chose X over Y because...

## Blockers / Notes for Next Session
- Any blockers or important context

## Next Steps
1. Complete OR-002: specific remaining work

## Resume Command
\`\`\`
Continue implementing epic OR-E{n} from task OR-{nnn}.
Read docs/tasks/checkpoint.md for full context.
Branch: epic/E{n}-{description}
\`\`\`
```

2. **Update `docs/tasks/todo.md`** with partial progress
3. **Commit work in progress:**

```bash
git add -A
git commit -m "WIP: checkpoint at OR-{nnn} - context handoff"
```

4. **Spawn continuation session** referencing the checkpoint file, epic ID, current task, and key decisions.

### Continuation Session Start

New session MUST:
1. Read `docs/tasks/checkpoint.md` first
2. Read `docs/tasks/lessons.md` for any new learnings
3. Read `AGENT.md`, then `docs/TOKEN-EFFICIENCY.md`, then `docs/PLAN.md`, then `docs/EXECUTION-RULES.md`
4. Verify branch and git status
5. Resume from documented next steps — do **not** read `docs/KICKOFF-PROMPT.md` unless starting fresh

### Checkpoint File Lifecycle

| Event | Action |
|---|---|
| Session start | Check for existing checkpoint |
| 75% context | Write checkpoint |
| Task complete | Update checkpoint |
| Epic complete | Archive checkpoint to `docs/tasks/checkpoints/{epic-id}.md` |
| Merge to `epic/autonomus-implementation` | Delete active checkpoint |

---

## 9. GitHub Branch Policy (Epic-to-Epic)

Remote: `origin` → [naqsh/Oriflame_MK](https://github.com/naqsh/Oriflame_MK) (public). The integration branch `epic/autonomus-implementation` is created from `origin/main`.

Each epic uses one feature branch merged into the long-lived integration branch `epic/autonomus-implementation`. Never merge epics directly to `main` during autonomous implementation.

### Per-Epic GitHub Flow

| Step | Action |
|---|---|
| Start | Branch from latest `epic/autonomus-implementation`; push `epic/E{n}-{description}` |
| Finish | Push branch; open PR with base `epic/autonomus-implementation` |
| CI | All workflow jobs must pass on the PR |
| Merge | Use **merge commit** only — do not squash or rebase |
| Post-merge | Pull `epic/autonomus-implementation`; delete **local** epic branch |
| Remote branch | **Keep** `origin/epic/E{n}-...` — do not delete after merge |
| Next epic | Create `epic/E{n+1}-...` from updated integration branch |

### Post-Merge Commands

```bash
git checkout epic/autonomus-implementation
git pull origin epic/autonomus-implementation
git branch -d epic/E{n}-{short-description}
# Do NOT run: git push origin --delete epic/E{n}-{short-description}
```

### Starting the Next Epic

```bash
git checkout epic/autonomus-implementation
git pull origin epic/autonomus-implementation
git checkout -b epic/E{n+1}-{short-description}
git push -u origin epic/E{n+1}-{short-description}
```

---

*Execution Rules — Version 0.1.0 — October 2026*
