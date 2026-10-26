# Example Code Directory — Oriflame Pakistan Referral Store

This directory contains reference implementations and code patterns for the project.

---

## Purpose

Before writing new code, consult this directory for:
- Established patterns in this codebase
- Correct usage of project conventions
- Examples of well-structured components

---

## Directory Structure

```
docs/example-code/
├── README.md                     # This file
├── api-endpoint-pattern.py       # Paginated FastAPI endpoint (router → service → repository)
├── settings-pattern.py           # Pydantic Settings + ConfigProvider
├── referral-service-pattern.py   # ReferralService with host allow-list
├── upsert-pattern.py             # Idempotent SQLAlchemy upsert + sync-run record
├── component-pattern.tsx         # Server Component with Zod-validated data
└── test-pattern.py               # pytest structure
```

---

## Patterns to Add

As the codebase develops, add examples for:

### Backend (Python)

- [ ] `api-endpoint-pattern.py` — Paginated, typed FastAPI endpoint
- [ ] `settings-pattern.py` — Pydantic Settings behind a `ConfigProvider`
- [ ] `referral-service-pattern.py` — Server-side referral resolution + validation
- [x] `upsert-pattern.py` — Idempotent upsert keyed on source id (OR-017; condensed from `backend/app/repositories/products.py`)
- [ ] `admin-dependency-pattern.py` — Admin authN/authZ dependency

### Frontend (TypeScript)

- [ ] `component-pattern.tsx` — Server Component fetching via `lib/api`
- [ ] `client-component-pattern.tsx` — Minimal interactive Client Component
- [ ] `zod-schema-pattern.ts` — Zod validation for API responses
- [ ] `jsonld-pattern.ts` — JSON-LD builder (verified `Offer` only)

### Testing

- [ ] `unit-test-pattern.py` — pytest structure
- [ ] `access-control-test-pattern.py` — Admin route rejection tests
- [ ] `component-test-pattern.tsx` — Vitest component test with ARIA assertions
- [ ] `e2e-pattern.spec.ts` — Playwright critical journey

---

## Usage

```python
# Before implementing a new endpoint, check:
# docs/example-code/api-endpoint-pattern.py

# Ensure your implementation follows the established pattern
```

---

*Last Updated: October 2026*
