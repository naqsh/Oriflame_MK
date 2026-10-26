---
description: Rules for the Coding Agent — FastAPI, SQLAlchemy/Alembic, Next.js, referral handling, catalogue integration
paths: ["**/*.py", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
---

# Coding Agent Rules — Oriflame Pakistan Referral Store

## Scope

This rule set governs all implementation work across the backend (Python), frontend (TypeScript/React), the Oriflame catalogue integration, and referral handling.

---

## Backend Standards (Python 3.12+)

### Framework & Dependencies
- **Runtime**: Python 3.12+ managed exclusively by `uv`
- **API Framework**: FastAPI with Pydantic v2 for all request/response models
- **ORM**: SQLAlchemy 2.x; parameterised operations only
- **Migrations**: Alembic for every schema change
- **Config**: `pydantic-settings` behind a lightweight `ConfigProvider` interface
- **HTTP**: `httpx` with explicit timeouts for every outbound call
- **Infrastructure**: No Redis/background jobs unless justified by actual requirements

### Code Patterns
```python
# REQUIRED: Layering — router → service → repository
@router.get("/products", response_model=ProductPage)
async def list_products(
    params: Annotated[ProductQuery, Depends()],
    service: Annotated[ProductService, Depends(get_product_service)],
) -> ProductPage:
    """Paginated product listing. No business logic in the router."""
    return await service.list(params)
```

```python
# REQUIRED: Referral resolution lives only in ReferralService
handoff = referral_service.resolve()  # validated official URL or manual-code instructions
```

### Imports
- Module-level only — no inline imports inside functions (Ruff `I001`)
- Order: stdlib → third party → local; run `uv run ruff check backend --fix` to auto-sort

### Error Handling
- Never catch generic `Exception` — catch specific exception types
- Sync failures recorded on `catalogue_sync_runs`
- Use `structlog` for all logging; never log secrets or the consultant code

---

## Frontend Standards (TypeScript/React)

### Framework & Dependencies
- **Framework**: Next.js App Router (no Pages Router)
- **Components**: Server Components by default; Client Components only for interactive UI
- **Styling**: Tailwind CSS; shadcn/ui where useful
- **Validation**: Zod for API responses and forms (React Hook Form where appropriate)
- **Images**: Next.js image optimisation; authorised assets only

### Code Patterns
```typescript
// REQUIRED: Type-safe, validated API responses
const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  pricePkr: z.number().nullable(),
  availability: z.enum(['verified_in_stock', 'verified_out_of_stock', 'not_confirmed']),
  sourceUrl: z.string().url(),
});
type Product = z.infer<typeof productSchema>;
```

### Component Requirements
| Component | Purpose | Consideration |
|---|---|---|
| `ProductCard` | Listing tile | Factual alt text; honest availability label |
| `ProductDetail` | PDP | Source link; Oriflame checkout note |
| `BuyFromOriflame` | Handoff button | Uses server-resolved destination only |
| `CopyReferralCode` | Manual-code flow | Client Component; no `NEXT_PUBLIC_` code |
| `ShoppingList` | Local list | Browser storage only; no payment/address |

---

## Referral Rules

- Referral code/URL are configuration — never constants in source.
- Resolve on the server; validate scheme and host against the allow-list.
- Use only an official referral URL or a documented, permitted mechanism.
- Never claim attribution without Oriflame confirmation.

---

## Catalogue Integration Rules

- Only permitted sources (official APIs, feeds, authorised exports).
- Never bypass authentication, anti-bot systems, access restrictions, or rate limits.
- Idempotent upserts with `source_url` and `last_synced_at`.
- Never fabricate products, SKUs, prices, ratings, reviews, or stock.
- Development mock data only in explicitly named fixtures.

---

## Secrets & Configuration

- **Never** hardcode secrets — inject via environment variables at runtime
- `.env.example` documents all required variables with safe empty defaults
- Secrets in CI/CD: GitHub Actions secrets or the hosting platform's secret store

---

## Testing Integration

- Every new endpoint requires a corresponding pytest test
- Every new React component requires a Vitest test with ARIA assertions
- Referral, config, catalogue upsert, and admin-access behaviours require explicit tests

---

## Epic Workflow (Agent Execution Order)

### 1. Branch Creation

```bash
git checkout epic/autonomus-implementation
git pull origin epic/autonomus-implementation
git checkout -b epic/E{n}-{short-description}
git push -u origin epic/E{n}-{short-description}
```

### 2. Coding Agent Phase
- Inspect the existing repository first
- Read all tasks from `docs/jira-tickets-json/OR-E{n}-*.json`
- Update `docs/tasks/todo.md` with implementation plan and assumptions
- Implement each task following IMPLEMENTATION DETAILS
- Handle all EDGE CASES listed in task description
- Commit after each logical unit of work

### 3. Refactor Agent Phase (handoff)
### 4. Testing Agent Phase (handoff)
### 5. Docs Agent Phase (handoff)

### 6. Verification Gates (Every Task)

```bash
uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
```

### 7. Merge Criteria
- [ ] All tasks in epic marked done
- [ ] Backend and frontend verification gates passed
- [ ] `docs/tasks/todo.md` updated with review section
- [ ] `docs/PLAN.md` shows epic as ✅ Completed
- [ ] PR approved and merged to `epic/autonomus-implementation` with a **merge commit**

After merge: pull the integration branch, delete the **local** epic branch, keep the remote branch.

### 8. Context Checkpoint (Long Sessions)

At ~75% context: write `docs/tasks/checkpoint.md`, commit WIP (`git commit -m "WIP: checkpoint at OR-{nnn}"`). See `docs/EXECUTION-RULES.md` §8.

---

*Coding Agent Rules — Version 0.1.0 — October 2026*
