# Learning Documentation — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Overview

The `docs/learning/` directory is used to capture new techniques, non-trivial bug fixes, and architectural patterns discovered during implementation.

## When to create a learning file

- Introducing a new technique (e.g. idempotent catalogue upserts, JSON-LD generation)
- Fixing a non-trivial bug that required structural changes
- Documenting patterns that multiple agents should follow

## File Naming

```
YYYY-MM-short-topic.md
```

## Format Example

Please use the following format for learning files:

```markdown
# Title of Learning

## Summary
Brief description of the technique or pattern.

## Technique
- Bullet points detailing the implementation
- How it works
- Benefits

## Code Reference
`path/to/relevant/file.py`

## Related
- ADR-001
- Issue #123
```
