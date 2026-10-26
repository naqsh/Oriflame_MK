# Observability — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

---

## Overview

Lean observability appropriate for a single-vendor MVP: structured logs, a health endpoint, catalogue sync visibility, referral click analytics, and Core Web Vitals. Add heavier tooling only when justified.

---

## Structured Logging

- `structlog` JSON output to stdout.
- Every log line carries a request id propagated from the incoming request.
- Never log secrets, the consultant code, or personal data.

| Event | Level | Fields |
|---|---|---|
| `request_completed` | info | method, path, status, duration_ms, request_id |
| `catalogue_sync_started/finished` | info | run_id, counts, duration_ms |
| `catalogue_sync_failed` | error | run_id, error_type (no secrets) |
| `referral_handoff` | info | method (`official_url`/`manual_code`), product_count |
| `admin_action` | info | action, admin_id (also in `audit_logs`) |

---

## Metrics Registry

| Metric | Source | Description |
|---|---|---|
| API error rate | logs / platform | 5xx share per endpoint |
| API latency | logs / platform | p95 duration per endpoint |
| Last successful sync age | `catalogue_sync_runs` | Time since last `success` run |
| Referral clicks | `referral_clicks` | Daily handoff count (admin analytics) |
| Core Web Vitals | Next.js / RUM | LCP, INP, CLS per page template |

---

## Health Checks

- `GET /health` — process liveness.
- `GET /health/ready` — database reachable.

---

## SLOs (initial)

| Objective | Target |
|---|---|
| API availability | 99.5% monthly |
| Product page LCP (p75) | < 2.5 s |
| CLS (p75) | < 0.1 |
| Catalogue freshness | Successful sync within the agreed source cadence |

---

## Alerts

Runbooks: `infrastructure/AGENT.md` → **Alert Runbooks** (HighErrorRate, CatalogueSyncFailing, ReferralMisconfigured, PoorCoreWebVitals).

---

*Observability — Version 0.1.0 — October 2026*
