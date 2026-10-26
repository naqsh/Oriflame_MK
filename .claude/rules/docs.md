---
description: Rules for the Documentation Agent — AGENT.md files, domain docs, architectural decisions
paths: ["**/*.md", "**/AGENT.md", "**/README.md", "**/CHANGELOG.md", "docs/**/*"]
---

# Documentation Agent Rules — Oriflame Pakistan Referral Store

## Scope

This rule set governs all documentation: domain AGENT.md files, domain docs (referral, catalogue, SEO, security), ADRs, learnings, and setup/deployment guides.

---

## AGENT.md File Standards

### Required Structure for Domain AGENT.md Files

Every major directory (`frontend/`, `backend/`, `infrastructure/`, and any new domain directory) MUST have an `AGENT.md` with this structure:

```markdown
# [Component Name] — Oriflame Pakistan Referral Store

## Scope
Brief description of what this directory/component governs.

## Technology Stack
Table of key dependencies with version constraints.

## Architecture
Directory tree.

## Workflow Rules
Table of specific, actionable rules for this component.

## Integration Points
How this component connects to others.

## Security Considerations
Component-specific security notes.
```

### AGENT.md Location Matrix

| Location | Purpose | MVP |
|---|---|---|
| `/AGENT.md` | Root index, workflow rules | MVP 1 |
| `/frontend/AGENT.md` | Next.js rules, pages, SEO, accessibility | MVP 1 |
| `/backend/AGENT.md` | FastAPI, data model, referral, catalogue rules | MVP 1 |
| `/infrastructure/AGENT.md` | CI/CD and deployment rules | MVP 1 |

---

## Domain Documentation Standards

| Doc | Must stay in sync with |
|---|---|
| `docs/REFERRAL.md` | `ReferralService`, `.env.example`, settings validation |
| `docs/CATALOGUE-DATA.md` | Integration code, sync-run model, catalogue ADR |
| `docs/SEO-AIO-GEO.md` | `frontend/lib/seo/`, sitemap, robots |
| `docs/SECURITY.md` | Admin auth, headers, CORS, rate limits |
| `backend/AGENT.md` data model table | Alembic migrations |
| `infrastructure/DEPLOYMENT.md` | Environment variables |

### Content Rules
- Never document fabricated catalogue data, prices, or attribution as real.
- Never imply official Oriflame affiliation or endorsement.
- Never promise SEO ranking outcomes.

---

## Architectural Decision Records (ADRs)

Create an ADR in `docs/adr/` when:
- Choosing between competing technologies
- Making irreversible architectural decisions
- Establishing patterns that affect multiple components
- Choosing or changing a catalogue source or referral method

Use the template in `docs/adr/README.md` and update its index.

---

## Changelog Standards

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
### Changed
### Fixed
### Security
```

---

## Documentation Quality Checklist

| Check | Description |
|---|---|
| ✅ Accuracy | All code references match actual implementation |
| ✅ Completeness | All required sections present |
| ✅ Currency | Version numbers and dates are current |
| ✅ Links | All internal links resolve correctly |
| ✅ Examples | Code examples are syntactically correct |
| ✅ Diagrams | Mermaid diagrams render correctly |
| ✅ Env sync | `.env.example` matches documented variables |

---

## Knowledge Capture Process

1. **Document in `docs/learning/`** — Create a dated `.md` file
2. **Link from relevant AGENT.md**
3. **Update lessons.md** — Add entry to `docs/tasks/lessons.md`
4. **Consider ADR** — If architectural

---

## Epic Workflow Position

1. ✅ Coding Agent — Implementation complete
2. ✅ Refactor Agent — Code quality verified
3. ✅ Testing Agent — Tests passing
4. **🔄 Docs Agent — You are here (final)**

### Handoff Checklist (Pre-Merge)

- [ ] New domain directories have AGENT.md files
- [ ] `docs/PLAN.md` updated with ✅ status
- [ ] `docs/tasks/todo.md` Review section completed
- [ ] Learnings captured in `docs/learning/`
- [ ] README and setup instructions updated (if user-facing changes)

### Post-Merge Tasks

After PR merged to `epic/autonomus-implementation` (via **merge commit**):

- [ ] Checkout and pull `epic/autonomus-implementation`
- [ ] Delete **local** epic branch; do **not** delete the remote epic branch
- [ ] Update `docs/tasks/todo.md` Completed Epics table
- [ ] Delete active `docs/tasks/checkpoint.md` (if present)

---

*Documentation Agent Rules — Version 0.1.0 — October 2026*
