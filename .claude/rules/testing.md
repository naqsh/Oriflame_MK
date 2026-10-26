---
description: Rules for the Testing Agent — pytest, Vitest, Playwright, referral/config/admin-access tests
paths: ["**/tests/**/*.py", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/test_*.py"]
---

# Testing Agent Rules — Oriflame Pakistan Referral Store

## Scope

This rule set governs unit, integration, security (access-control), and end-to-end testing.

---

## Backend Testing (Python)

### Framework & Dependencies
- **Test Runner**: pytest (+ pytest-asyncio where async)
- **Coverage**: pytest-cov, minimum 80% line coverage
- **HTTP**: httpx `AsyncClient` against the FastAPI app
- **Database**: real PostgreSQL via `TEST_POSTGRES_URL` (CI service container or local `supabase start`) with Alembic migrations applied — never the hosted Supabase project
- **External sources**: always mocked — CI never hits Oriflame

### Test Structure
```text
backend/tests/
├── conftest.py              # App, DB, settings, source mocks
├── unit/
│   ├── test_referral.py     # URL generation, host allow-list, manual-code
│   ├── test_config.py       # Single-vendor settings validation
│   └── test_schemas.py      # Pydantic validation
├── integration/
│   ├── test_products_api.py # Pagination, filters, 404s
│   ├── test_search_api.py
│   └── test_catalogue_sync.py # Idempotent upserts, failure recording
└── security/
    ├── test_admin_access.py # Unauthenticated/unauthorised rejected
    └── test_headers_cors.py
```

### Required Test Patterns

```python
@pytest.mark.asyncio
async def test_admin_requires_auth(client: AsyncClient) -> None:
    response = await client.post("/api/v1/admin/sync")
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


def test_sync_is_idempotent(sync_runner, source_fixture, db) -> None:
    sync_runner.run(source_fixture)
    sync_runner.run(source_fixture)
    assert db.count_products() == len(source_fixture.products)


def test_referral_rejects_unlisted_host() -> None:
    with pytest.raises(ValidationError):
        Settings(ORIFLAME_REFERRAL_URL="https://evil.example.com/ref")
```

---

## Frontend Testing (TypeScript)

### Framework & Dependencies
- **Unit/Component**: Vitest + Testing Library (+ user-event)
- **E2E**: Playwright for critical customer journeys (where practical)
- **Coverage**: Minimum 75% for components, 90% for `lib/seo` and `lib/api` utilities

### Required Test Cases
- Availability label shows "Availability not confirmed" when unverified
- JSON-LD builder omits `Offer` when price/availability unverified
- `BuyFromOriflame` renders the server-provided destination only
- Copy-code action works with keyboard and has an accessible name
- Shopping list persists locally and collects no address/payment data

### Critical Journey (Playwright)
Homepage → category → product detail → add to list → "Buy from Oriflame" handoff (mocked API / dev fixtures).

---

## Mandatory Coverage Matrix

| Area | Test | Status |
|---|---|---|
| Referral URL generation | `test_referral.py` | Required |
| Single-vendor configuration | `test_config.py` | Required |
| Catalogue upserts | `test_catalogue_sync.py` | Required |
| API validation | `test_*_api.py` | Required |
| Admin access | `test_admin_access.py` | Required |
| Critical customer journey | Playwright spec | Required where practical |

---

## CI/CD Integration

```yaml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
  steps:
    - uses: actions/checkout@v4
    - uses: astral-sh/setup-uv@v4
    - run: uv sync --frozen
    - run: uv run alembic upgrade head
      env:
        POSTGRES_URL: postgresql://postgres:postgres@localhost:5432/postgres
    - run: uv run pytest --cov=backend --cov-report=xml
    - run: npm ci --prefix frontend
    - run: npm run test --prefix frontend -- --coverage
```

### Coverage Gates
- Backend: 80% line coverage minimum
- Frontend: 75% line coverage minimum
- No PR merge with failing or unexplained skipped tests

---

## Epic Workflow Position

1. ✅ Coding Agent — Implementation complete
2. ✅ Refactor Agent — Code quality verified
3. **🔄 Testing Agent — You are here**
4. ⬜ Docs Agent — Final

### Handoff Checklist

- [ ] Backend gate passed: `uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest`
- [ ] Frontend gate passed: `npm run lint && npm run typecheck && npm run test && npm run build`
- [ ] All `TESTING CRITERIA` from task JSON implemented
- [ ] Coverage targets met
- [ ] No skipped tests without documented reason
- [ ] CI pipeline passes

---

*Testing Agent Rules — Version 0.1.0 — October 2026*
