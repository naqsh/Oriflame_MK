# Architectural Decision Records (ADR) — Oriflame Pakistan Referral Store

This directory contains Architectural Decision Records documenting significant technical decisions.

---

## Purpose

Create an ADR when:
- Choosing between competing technologies
- Making irreversible architectural decisions
- Establishing patterns that affect multiple components
- Changing existing architectural decisions
- Choosing or changing a catalogue data source (including image/content permissions)

---

## File Naming Convention

```
ADR-NNN-short-description.md
```

Examples:
- `ADR-001-catalogue-data-source.md`
- `ADR-002-referral-method.md`
- `ADR-003-admin-authentication.md`

---

## Template

```markdown
# ADR-NNN: [Decision Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]
**Date:** YYYY-MM-DD
**Authors:** [Names or 'Claude Code Agent']

## Context

What is the issue that we're seeing that motivates this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive
- What becomes easier

### Negative
- What becomes more difficult

### Neutral
- Other impacts

## Alternatives Considered

### Alternative 1: [Name]
- Description
- Why rejected

### Alternative 2: [Name]
- Description
- Why rejected

## References

- Links to relevant documentation
- Related ADRs
```

---

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-005](ADR-005-configuration-provider-seam.md) | Configuration provider seam | Accepted | 2026-10-26 |
| [ADR-006](ADR-006-scaffold-toolchain-choices.md) | Scaffold toolchain choices (MVP 1) | Accepted | 2026-10-26 |

---

## Pending Decisions

Decisions that need ADRs during implementation (ADR numbers reserved by epic tasks):

1. **ADR-001 Catalogue data source** (OR-010) — official API vs product feed vs authorised export; image/content usage rights; sync cadence
2. **ADR-002 Referral method** (OR-029) — `official_url` vs `manual_code`; allowed referral hosts
3. **ADR-003 Admin authentication** (OR-044) — session-based vs JWT vs external identity provider
4. **ADR-004 Deployment target** (OR-052) — hosting for Next.js and FastAPI (database is Supabase — see `docs/DATABASE.md`)
5. ~~Configuration provider seam~~: decided in [ADR-005](ADR-005-configuration-provider-seam.md)

---

*Last Updated: October 2026*
