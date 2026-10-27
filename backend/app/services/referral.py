"""The only place referral handoffs are decided (OR-030, ADR-002).

Configuration comes only through the ConfigProvider (server-side environment). The
URL is re-validated on every resolve (defence in depth), a consultant code is never
appended to any URL, and no text claims or promises attribution.
"""

from typing import Annotated

from fastapi import Depends

from backend.app.core.config import (
    ConfigProvider,
    get_config_provider,
    referral_url_problem,
)
from backend.app.schemas.referral import (
    ManualCodeHandoff,
    OfficialUrlHandoff,
    ReferralHandoff,
    ReferralStatus,
    UnavailableHandoff,
)

# Must be an allowed host (a unit test checks it).
OFFICIAL_SITE_HOST = "pk.oriflame.com"
OFFICIAL_SITE_URL = f"https://{OFFICIAL_SITE_HOST}/"

CHECKOUT_NOTE = "Checkout, payment and delivery are handled by Oriflame on its official website."
OFFICIAL_URL_NOTE = f"You are continuing to Oriflame's official Pakistan website. {CHECKOUT_NOTE}"
MANUAL_CODE_INSTRUCTIONS = [
    "Continue to Oriflame's official Pakistan website and add your products there.",
    "If Oriflame asks for a consultant or Brand Partner code, enter the code shown here.",
    CHECKOUT_NOTE,
]
UNAVAILABLE_MESSAGE = (
    f"You can complete your purchase on Oriflame's official Pakistan website. {CHECKOUT_NOTE}"
)


class ReferralService:
    def __init__(self, config: ConfigProvider) -> None:
        self._config = config

    def resolve(self) -> ReferralHandoff:
        """The handoff for the current configuration, read fresh on every call."""
        referral = self._config.get_referral_config()
        if referral.method == "manual_code":
            if referral.consultant_code is None:
                return self._unavailable("not_configured")
            return ManualCodeHandoff(
                code=referral.consultant_code.get_secret_value(),
                instructions=list(MANUAL_CODE_INSTRUCTIONS),
                checkout_url=OFFICIAL_SITE_URL,
            )
        if referral.referral_url is None:
            return self._unavailable("not_configured")
        url = str(referral.referral_url)
        if referral_url_problem(url) is not None:
            return self._unavailable("invalid")
        return OfficialUrlHandoff(url=url, note=OFFICIAL_URL_NOTE)

    def status(self) -> ReferralStatus:
        """For the admin view (OR-E6): never returns the code or URL."""
        handoff = self.resolve()
        if isinstance(handoff, UnavailableHandoff):
            return handoff.reason
        return "configured"

    @staticmethod
    def _unavailable(reason: str) -> UnavailableHandoff:
        return UnavailableHandoff(
            reason="invalid" if reason == "invalid" else "not_configured",
            message=UNAVAILABLE_MESSAGE,
            fallback_url=OFFICIAL_SITE_URL,
        )


def get_referral_service(
    config: Annotated[ConfigProvider, Depends(get_config_provider)],
) -> ReferralService:
    return ReferralService(config)
