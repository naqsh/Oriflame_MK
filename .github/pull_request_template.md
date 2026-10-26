## Summary

<!-- What changed and why -->

## Security & integrity checklist

- [ ] No secrets, consultant code, or `.env` committed; no private values behind `NEXT_PUBLIC_`
- [ ] Referral handling goes through `ReferralService`; referral host validated
- [ ] No fabricated products, prices, reviews, stock, or attribution; mock data only in named dev fixtures
- [ ] Admin routes require authentication and authorisation
- [ ] Schema changes include an Alembic migration
- [ ] New dependencies justified

## Test plan

- [ ] `uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest`
- [ ] `cd frontend && npm run lint && npm run typecheck && npm run test && npm run build`
