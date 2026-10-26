---
description: Rules for the Refactor Agent — Pydantic schemas, strict typing, layer boundaries, technical debt
paths: ["**/*.py", "**/*.ts", "**/*.tsx"]
---

# Refactor Agent Rules — Oriflame Pakistan Referral Store

## Scope

This rule set governs refactoring: schema tightening, type safety, boundary enforcement (routers/services/repositories/integration/admin), deduplication, and technical debt reduction.

---

## Pydantic v2 Schema Standards

- Pydantic v2 exclusively (no v1 compatibility mode)
- `extra="forbid"` on request models; strict types for external input
- Bounded pagination (`page >= 1`, `1 <= page_size <= MAX`)

```python
class ProductQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, pattern=r"^[a-z0-9-]+$")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=100)
```

### Anti-Patterns to Refactor

| Anti-Pattern | Refactor To |
|---|---|
| Business logic in routers | Move to services |
| SQL/ORM calls in services | Move to repositories |
| Referral URL built outside `ReferralService` | Route through `ReferralService` |
| `os.environ[...]` reads in code | Typed settings via `ConfigProvider` |
| `Any` type annotations | Specific types |
| `Optional[X]` | `X | None` |
| `class Config:` (Pydantic v1) | `model_config = ConfigDict(...)` |

---

## TypeScript Strict Typing

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- Zod schemas are the single source of API types (`z.infer`).
- Remove unnecessary `"use client"` directives; push interactivity to leaf components.

---

## Boundary Preservation

1. Integration code stays in `integrations/oriflame/` — replaceable source.
2. Admin-only logic stays behind admin routers/dependencies.
3. No tenant assumptions hardcoded in services — configuration flows through `ConfigProvider`.
4. Schema changes always accompanied by an Alembic migration.

---

## Technical Debt Checklist

| Area | Indicator | Action |
|---|---|---|
| Type Coverage | `mypy` / `tsc` errors > 0 | Fix all type errors |
| Duplication | Similar code in 3+ locations | Extract to shared utility |
| Complexity | Function > 50 lines | Split into smaller functions |
| File size | Oversized module | Split into cohesive modules |
| Dependencies | Unused packages | Remove |
| Tests | Coverage < targets | Add missing test cases |

---

## Epic Workflow Position

1. ✅ Coding Agent — Implementation complete
2. **🔄 Refactor Agent — You are here**
3. ⬜ Testing Agent — Next
4. ⬜ Docs Agent — Final

### Handoff Checklist

- [ ] Layer boundaries respected
- [ ] Referral logic centralised in `ReferralService`
- [ ] No hardcoded configuration or secrets
- [ ] Backend gate passed: `uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest`
- [ ] Frontend gate passed: `npm run lint && npm run typecheck && npm run test && npm run build`

---

*Refactor Agent Rules — Version 0.1.0 — October 2026*
