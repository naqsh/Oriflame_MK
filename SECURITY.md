# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ Active development |

## Reporting a Vulnerability

Report security issues privately via GitHub Security Advisories on this repository.
Do not open public issues for undisclosed vulnerabilities.

Include:

- Affected component (backend, frontend, admin area, referral handling, catalogue sync)
- Reproduction steps
- Impact assessment

We aim to acknowledge reports within 48 hours.

## Secret Handling

- Commit `.env.example` only; never commit `.env`, real consultant codes, or credentials.
- Referral code and URL are resolved server-side; the consultant code is never exposed via `NEXT_PUBLIC_` unless confirmed intentionally public.
- Never log secrets or sensitive values.

## Supply Chain Controls

- **pip-audit** and **npm audit** run in CI and block critical/high CVEs in production dependencies.
- Dependencies are kept lean; material additions are justified in the PR.
- Details: `docs/SUPPLY-CHAIN-SECURITY.md`.

## Security Documentation

Full architecture and controls: [`docs/SECURITY.md`](docs/SECURITY.md)
