# Deployment Gates — Release Criteria

**Version:** 0.1.0 | **Last Updated:** October 2026

Production deployments MUST pass these gates before promotion.

---

## Gates

| Gate ID | Name | Target | Automated in CI (`.github/workflows/ci.yml`) |
|---|---|---|---|
| `backend_gate` | Backend verification | All four commands pass | `backend` job: ruff, ruff format --check, mypy, pytest (coverage ≥ 80%) |
| `frontend_gate` | Frontend verification | All pass | `frontend` job: ESLint, typecheck, Vitest (coverage thresholds), build |
| `migrations` | Migrations current | `alembic upgrade head` succeeds on a fresh DB | `backend` job step "Alembic upgrade head on a fresh database"; `test_migrations.py` (upgrade, downgrade base and -1) |
| `supabase_rls` | Data API locked down | RLS enabled on every application table in `public` | `test_migrations.py::test_rls_enabled_on_every_public_table` |
| `dependency_audit` | No critical/high CVEs | pip-audit + npm audit clean | `pip-audit`; `npm audit --omit=dev --audit-level=high` |
| `referral_config` | Referral configured | Settings validate; host on allow-list | Startup validation (`core/config.py`), `test_config.py`, `test_referral.py`, `test_referral_adr.py`. Whether real values are set is an owner check at deploy time |
| `production_config` | Production settings strict | Startup fails on missing `POSTGRES_URL` or non-https/wildcard `CORS_ORIGINS` | `test_config.py` |
| `admin_protected` | Admin access control | Unauthenticated admin requests rejected | `tests/security/test_admin_access.py` (every admin route, enumerated); Playwright `admin-protection.spec.ts` |
| `security_headers` | Hardening headers | CSP, HSTS, nosniff, frame-ancestors on API and site | `test_headers_cors.py`, `security-headers.test.ts`; Playwright runs with the CSP on |
| `no_fixtures_in_prod` | Fixtures disabled | Fixture loading impossible when `APP_ENV=production` | `test_source_fixtures.py`, `test_cli.py`, `test_admin_sync_referral.py` |
| `seo_basics` | SEO artefacts | Sitemap + robots.txt served; JSON-LD valid | `seo-crawl.test.ts`, `seo-jsonld.test.tsx`; Playwright `smoke.spec.ts` (robots.txt and sitemap served). External JSON-LD validation needs the public URL (manual, after the first deploy) |
| `e2e` | Critical journeys | Browse → handoff, search, admin sign-in | `e2e` job with a Postgres service |

---

## Production Prerequisites

| Variable | Requirement |
|---|---|
| `APP_ENV` | `production` |
| `POSTGRES_URL` | Production Supabase project connection string (not the development project) |
| `CORS_ORIGINS` | Production frontend origin(s) only |
| `ORIFLAME_REFERRAL_URL` / `ORIFLAME_CONSULTANT_CODE` | Real, approved values (or `manual_code` method) |
| Admin account | Created once with the `create-admin` CLI (ADR-003); no secret variable |
| `SITE_URL`, `NEXT_PUBLIC_API_BASE_URL` | Set before the frontend build |

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
