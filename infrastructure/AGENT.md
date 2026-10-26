# Infrastructure Agent

**Version:** 0.1.0 | **Last Updated:** October 2026

## Scope

CI/CD, GitHub branch policy, environment configuration, alerting runbooks, and deployment rules for the Oriflame Pakistan Referral Store.

---

## Repository

| Item | Value |
|---|---|
| GitHub repo | [naqsh/Oriflame_MK](https://github.com/naqsh/Oriflame_MK) |
| Clone | `gh repo clone naqsh/Oriflame_MK` |
| Visibility | **Public** — secrets must never be committed; CI secrets live in GitHub Actions secrets |
| Default branch | `main` (currently contains only `LICENSE`; the integration branch is created from it) |
| Remote name | `origin` |

The local working folder `D:\Projects\OriflameMK` already holds the project docs, so connect it to the remote (OR-001) instead of cloning over it:

```bash
git init
git remote add origin https://github.com/naqsh/Oriflame_MK.git
git fetch origin
git checkout -b main origin/main   # brings in LICENSE; local untracked docs are kept
```

---

## GitHub Branch Policy

| Branch | Purpose |
|---|---|
| `epic/autonomus-implementation` | Long-lived integration branch — all epics merge here |
| `epic/E{n}-{short-description}` | Short-lived per-epic work branch |
| `main` | Not used for epic merges during autonomous implementation |

### Epic-to-Epic Flow

1. Branch from latest `epic/autonomus-implementation`
2. Push `epic/E{n}-...`; implement → refactor → test → docs
3. Open PR with base `epic/autonomus-implementation`
4. Merge with a **merge commit** after CI passes (not squash or rebase)
5. Pull integration branch; delete **local** epic branch
6. **Do not** delete the remote epic branch on GitHub
7. Start next epic from updated `epic/autonomus-implementation`

---

## CI Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | PR + push to integration | Ruff, mypy, pytest (PostgreSQL service container via `TEST_POSTGRES_URL` + Alembic upgrade — never the Supabase project), pip-audit; ESLint, tsc, Vitest, Next.js build, npm audit; Playwright (where practical) |

CI never uses real consultant codes or live Oriflame endpoints — use placeholder env values and mocked sources.

---

## Environment Configuration

- Runtime configuration comes from deployment environment settings; `.env` is never committed.
- `ORIFLAME_CONSULTANT_CODE` and `ORIFLAME_REFERRAL_URL` are set per environment. Updating them is a deployment-settings change, not an admin-UI action (MVP).
- `CORS_ORIGINS` lists only the deployed frontend origin(s).

---

## Alert Runbooks

### HighErrorRate

1. Check API error rate and recent logs by request id.
2. Roll back the latest deployment if the spike correlates with a release.

### CatalogueSyncFailing

1. Inspect the latest `catalogue_sync_runs` rows for status and error detail.
2. Confirm the permitted source is reachable and access terms unchanged.
3. Retry only after the root cause is fixed — sync is idempotent, so retries must not duplicate.

### ReferralMisconfigured

1. Check admin referral configuration status.
2. Verify `ORIFLAME_REFERRAL_URL` host is on the allow-list and `ORIFLAME_REFERRAL_METHOD` is valid.
3. Fix environment settings and redeploy.

### PoorCoreWebVitals

1. Review LCP/INP/CLS by page template.
2. Check image sizes, client bundle size, and uncached API calls.

---

## Deployment Reference

See `infrastructure/DEPLOYMENT.md` for step-by-step deployment, rollback, and configuration.

---

*Infrastructure Agent — Version 0.1.0 — October 2026*
