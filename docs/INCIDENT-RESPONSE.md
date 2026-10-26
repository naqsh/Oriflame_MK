# Incident Response — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

Procedures for detecting, triaging, and resolving incidents.

---

## Severity Classification

| Severity | Examples | Response SLA |
|---|---|---|
| **P1 Critical** | Secret/consultant code leaked publicly, admin routes exposed, referral handoff redirecting to a non-Oriflame host | 1 hr acknowledge, 4 hr contain |
| **P2 High** | Site down, misleading availability/price shown, catalogue sync corrupting data | 4 hr acknowledge, 24 hr resolve |
| **P3 Medium** | Sync failing repeatedly, broken SEO artefacts, Core Web Vitals regression | Next business day |
| **P4 Low** | Documentation gap, non-production test failure | Planned work |

---

## Response Workflow

```
Detect → Triage → Contain → Eradicate → Recover → Review
```

1. **Detect:** Alerts, logs, admin sync status, user reports
2. **Triage:** Assign severity
3. **Contain:** Rotate leaked secrets, disable handoff or admin route, roll back release
4. **Eradicate:** Fix root cause per `docs/GOVERNANCE.md`
5. **Recover:** Redeploy, rerun sync, verify handoff and admin protection
6. **Review:** Add a row to `docs/tasks/lessons.md`; create ADR if architectural

---

## Related Documents

- `docs/GOVERNANCE.md`
- `docs/OBSERVABILITY.md`
- `infrastructure/AGENT.md` — alert runbooks
- `infrastructure/DEPLOYMENT.md` — rollback

---

*Incident Response — Version 0.1.0 — October 2026*
