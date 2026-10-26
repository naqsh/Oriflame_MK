# Supply Chain Security

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Dependency Policy

- Keep dependencies lean; explain material additions in the PR.
- Lock files are committed (`uv.lock`, `package-lock.json`).
- Use compatible stable releases; record versions in `docs/ENGINEERING-STANDARDS.md`.

---

## CI Audit Gates

| Tool | Scope | Blocks on |
|---|---|---|
| `uv run pip-audit` | Backend runtime deps | Critical / high CVEs |
| `npm audit --omit=dev` | Frontend runtime deps | Critical / high CVEs |

**CVE with no fix available:** document the exception in `docs/adr/` with an expiry date.

---

## Recommended Repository Practices

| Practice | Requirement |
|---|---|
| Security Policy | `SECURITY.md` at repo root |
| Dependency updates | Dependabot / Renovate |
| Code review | Required for all PRs |
| Static checks | Ruff + mypy + ESLint + tsc in CI |

---

## Third-Party Services

| Service | Purpose | Notes |
|---|---|---|
| Oriflame Pakistan (official site) | Checkout destination; catalogue source if permitted | Access terms recorded in ADR |
| Hosting provider | Deployment | Pending decision |

---

## Related Documentation

- `SECURITY.md`
- `docs/SECURITY.md`

---

*Supply Chain Security — Version 0.1.0 — October 2026*
