# Governance — Oriflame Pakistan Referral Store

**Version:** 0.1.0 | **Last Updated:** October 2026

Ownership of content, configuration, data sources, and changes for the single-vendor MVP.

---

## Roles

| Role | Responsibility | Owner |
|---|---|---|
| **Store Owner (Vendor)** | Referral code/URL approval, brand/affiliation wording, content sign-off | Vendor |
| **Engineering** | Code, migrations, CI, deployments | Developer / coding agents |
| **Data Steward** | Catalogue source permissions, image/content rights, sync health | Vendor + Engineering |
| **Security** | Admin access, secrets, dependency audits | Engineering |

---

## Asset Ownership

| Asset | Owner | Review Frequency |
|---|---|---|
| Referral configuration (env) | Store Owner | On any change |
| Catalogue source + permissions (ADR) | Data Steward | On source/terms change |
| Product images/content rights | Data Steward | On source change |
| Legal pages (privacy, terms, cookies) | Store Owner | Before launch, then yearly |
| Affiliation/disclaimer wording | Store Owner | Before launch |
| Dependencies | Security | Every CI run |

---

## Change Authorization

| Change | Approval |
|---|---|
| Referral code/URL or method | Store Owner |
| New catalogue source or scraping approach | Store Owner + ADR — never bypass access controls |
| Checkout/payment integration | Explicit owner approval (out of MVP scope) |
| Paid services | Explicit owner approval |
| Destructive data changes | Explicit owner approval |
| Emergency security fix | Engineering may deploy; retrospective review within 48 hours |

---

## Deployment Gates

See `docs/DEPLOYMENT-GATES.md`.

---

*Governance — Version 0.1.0 — October 2026*
