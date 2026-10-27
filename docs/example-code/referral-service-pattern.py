"""Server-side referral resolution with a host allow-list.

A condensed version of backend/app/services/referral.py (OR-030, ADR-002). The rules:

- Configuration comes only through the ConfigProvider (server-side environment).
- The destination is re-validated on every resolve, not just at startup.
- The client never supplies a destination; the result is a typed union.
- A consultant code is never appended to a URL, and no text claims attribution.
"""

from typing import Literal

from pydantic import BaseModel

from backend.app.core.config import ConfigProvider, referral_url_problem

OFFICIAL_SITE_URL = "https://pk.oriflame.com/"  # an allowed host; no referral attached


class OfficialUrl(BaseModel):
    method: Literal["official_url"] = "official_url"
    url: str


class ManualCode(BaseModel):
    method: Literal["manual_code"] = "manual_code"
    code: str
    checkout_url: str


class Unavailable(BaseModel):
    method: Literal["unavailable"] = "unavailable"
    reason: Literal["not_configured", "invalid"]
    fallback_url: str


def resolve(config: ConfigProvider) -> OfficialUrl | ManualCode | Unavailable:
    referral = config.get_referral_config()
    if referral.method == "manual_code":
        if referral.consultant_code is None:
            return Unavailable(reason="not_configured", fallback_url=OFFICIAL_SITE_URL)
        # The owner chose manual_code, so the code may be shown to visitors.
        return ManualCode(
            code=referral.consultant_code.get_secret_value(), checkout_url=OFFICIAL_SITE_URL
        )
    if referral.referral_url is None:
        return Unavailable(reason="not_configured", fallback_url=OFFICIAL_SITE_URL)
    url = str(referral.referral_url)
    # Defence in depth: https, exact allow-listed host, no credentials/fragment/odd port.
    if referral_url_problem(url) is not None:
        return Unavailable(reason="invalid", fallback_url=OFFICIAL_SITE_URL)
    return OfficialUrl(url=url)
