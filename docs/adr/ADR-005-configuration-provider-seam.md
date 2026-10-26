# ADR-005: Configuration Provider Seam

**Status:** Accepted
**Date:** 2026-10-26
**Authors:** Claude Code Agent (OR-002)

## Context

The store has one vendor today, but the referral code and URL must be configurable without code changes. A later phase may need admin-editable or tenant-aware settings. `docs/REFERRAL.md` asks for a lightweight provider interface now, with environment variables as the only MVP provider, and no settings database or admin UI.

## Decision

- `backend/app/core/config.py` holds one validated `Settings` class (pydantic-settings). It reads environment variables, plus `.env` in development, once, and caches the result (`get_settings`).
- Services depend on a `ConfigProvider` **Protocol** with two methods: `get_settings()` and `get_referral_config()`. The second returns a frozen `ReferralConfig` (country, method, consultant code, URL, `is_configured`).
- `EnvConfigProvider` is the only implementation. FastAPI code gets it through the `get_config_provider` dependency, which tests can override.
- Validation happens at startup:
  - `ORIFLAME_REFERRAL_URL` must be https with a host in `ALLOWED_REFERRAL_HOSTS`. Only `pk.oriflame.com` is allowed, as confirmed by the owner.
  - `manual_code` requires a consultant code.
  - Bad values raise a `ConfigurationError` whose message never contains the value.
- The consultant code is a `SecretStr`, so it never appears in a repr, a log or a `model_dump`.
- Nothing outside `config.py` reads `os.environ`.

## Consequences

### Positive
- A database-backed or tenant-aware provider can be added later by implementing the Protocol. Services do not change.
- Misconfiguration fails at startup with actionable messages. Empty referral values still start, and report "not configured".

### Negative
- Changing the allow-list is a code change and a redeploy, not a setting. This is deliberate: hosts must be owner-confirmed.

### Neutral
- `Settings` is cached per process, so a config change needs a restart. Tests clear the caches.

## Alternatives Considered

### Alternative 1: Read `os.environ` where needed
- Simple, but scatters validation and makes a future provider a wide refactor. Rejected.

### Alternative 2: Settings table plus admin UI now
- Explicitly out of scope for the MVP (`docs/REFERRAL.md`), and an environment-backed form would mislead admins. Rejected.

## References

- `backend/app/core/config.py`, `backend/tests/unit/test_config.py`
- `docs/REFERRAL.md`, `docs/DATABASE.md`
- ADR-002 (referral method, pending)
