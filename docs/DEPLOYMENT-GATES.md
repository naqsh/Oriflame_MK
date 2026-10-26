# Deployment Gates — Release Criteria

**Version:** 0.1.0 | **Last Updated:** October 2026

Production deployments MUST pass these gates before promotion.

---

## Gates

| Gate ID | Name | Target | Source |
|---|---|---|---|
| `backend_gate` | Backend verification | All four commands pass | `uv run ruff check backend && uv run ruff format backend && uv run mypy backend && uv run pytest` |
| `frontend_gate` | Frontend verification | All pass | `npm run lint && npm run typecheck && npm run test && npm run build` |
| `migrations` | Migrations current | `alembic upgrade head` succeeds on a fresh DB | CI |
| `supabase_rls` | Data API locked down | RLS enabled on every application table in `public` | Test (`docs/DATABASE.md`) |
| `dependency_audit` | No critical/high CVEs | pip-audit + npm audit clean | CI |
| `referral_config` | Referral configured | Settings validate; host on allow-list | Startup validation |
| `admin_protected` | Admin access control | Unauthenticated admin requests rejected | `tests/security/` |
| `no_fixtures_in_prod` | Fixtures disabled | Fixture loading impossible when `APP_ENV=production` | Test |
| `seo_basics` | SEO artefacts | Sitemap + robots.txt served; JSON-LD valid | Smoke test |

---

## Production Prerequisites

| Variable | Requirement |
|---|---|
| `APP_ENV` | `production` |
| `POSTGRES_URL` | Production Supabase project connection string (not the development project) |
| `CORS_ORIGINS` | Production frontend origin(s) only |
| `ORIFLAME_REFERRAL_URL` / `ORIFLAME_CONSULTANT_CODE` | Real, approved values (or `manual_code` method) |
| Admin auth secrets | Set per admin auth ADR |

---

## CI Integration

Gates run in `.github/workflows/ci.yml`. Any failure blocks merge to `epic/autonomus-implementation` and release.

---

## Related Documentation

- `docs/GOVERNANCE.md`
- `docs/OBSERVABILITY.md`
- `infrastructure/DEPLOYMENT.md`

---

*Deployment Gates — Version 0.1.0 — October 2026*
