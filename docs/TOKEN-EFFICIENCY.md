# Token Efficiency Rules — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

Rules for Claude Code Agents to minimize context window usage. **Read this file before `docs/KICKOFF-PROMPT.md`.**

---

## 1. What to Read (and Skip)

### Every session ("hi" / continuation)

| Read (in order) | Skip unless task requires it |
|---|---|
| `docs/tasks/checkpoint.md` | `docs/KICKOFF-PROMPT.md` |
| `docs/tasks/lessons.md` | `docs/ARCHITECTURE.md` |
| `AGENT.md` | Other epic JSON files |
| `docs/TOKEN-EFFICIENCY.md` (this file) | `docs/example-code/` |
| `docs/PLAN.md` | Full `.claude/rules/*` set |
| `docs/EXECUTION-RULES.md` | Domain docs (`SECURITY.md`, `REFERRAL.md`, `CATALOGUE-DATA.md`, `SEO-AIO-GEO.md`) |

### Fresh implementation kickoff only

After the session reads above, also read:

- `docs/KICKOFF-PROMPT.md`
- Current epic JSON only (e.g. `docs/jira-tickets-json/OR-E1-mvp1-scaffold.json`, when present)
- Relevant `.claude/rules/*.md` for the active agent phase (coding → refactor → test → docs)

---

## 2. Tool Use

| Do | Don't |
|---|---|
| `Grep` / `Glob` to locate symbols, then targeted `Read` | Read entire directories or large files whole |
| `Read` with `offset` / `limit` on files >200 lines | Re-read files already in checkpoint or todo |
| Batch parallel tool calls when independent | Sequential discovery that could run in parallel |
| Delegate broad exploration to subagents | Load the repo map manually file-by-file |
| Read one task's JSON fields (`Description`, edge cases) | Load all epic JSON files at once |

---

## 3. Implementation Discipline

- **Minimal diffs** — change only what the task requires; no drive-by refactors.
- **Checkpoint is truth** — resume from `checkpoint.md`; do not re-audit completed work.
- **Scope docs on demand** — open `docs/SECURITY.md`, `backend/AGENT.md`, etc. only when the current task touches that area.
- **Rules on demand** — load `.claude/rules/coding.md` when coding; load refactor/testing/docs rules only in those phases.

---

## 4. Context Handoff

- Write `docs/tasks/checkpoint.md` at ~75% context usage (see `docs/EXECUTION-RULES.md` §8).
- Checkpoint must list: epic, branch, current task, files touched, next steps — enough to resume without re-reading the codebase.
- Commit WIP before session end.

---

## 5. Responses to the User

- Keep replies concise; answer the question asked.
- Cite code with line ranges — do not paste entire files into chat.
- Do not restate full plans or repeat tool output the user can already see.
- Summaries only when synthesizing multi-step work or handing off.

---

## 6. MUST NOT

- Read `docs/KICKOFF-PROMPT.md` on every "hi" — only for fresh autonomous kickoff.
- Dump large directory listings or full file contents in responses.
- Re-read `AGENT.md` / `EXECUTION-RULES.md` mid-task if rules are already loaded this session.
- Explore unrelated epics or MVPs while a checkpoint task is in progress.

---

*Token Efficiency Rules — Version 0.1.0 — October 2026*
