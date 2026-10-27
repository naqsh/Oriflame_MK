"""The only place referral handoffs are decided (OR-030, ADR-002).

Configuration comes only through the ConfigProvider (server-side environment). The
URL is re-validated on every resolve (defence in depth), a consultant code is never
appended to any URL, and no text claims or promises attribution.
"""

import re
from typing import Annotated

import structlog
from fastapi import Depends
from sqlalchemy import exists, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.core.config import (
    ConfigProvider,
    get_config_provider,
    referral_url_problem,
)
from backend.app.db.session import get_db
from backend.app.models import Product
from backend.app.repositories.referral_clicks import record
from backend.app.schemas.products import SLUG_PATTERN
from backend.app.schemas.referral import (
    HandoffRequest,
    ManualCodeHandoff,
    OfficialUrlHandoff,
    ReferralHandoff,
    ReferralStatus,
    UnavailableHandoff,
)

logger = structlog.get_logger(__name__)

# Clicks from obvious bots are not counted. The user agent is only inspected here,
# never stored (OR-031).
BOT_USER_AGENT = re.compile(
    r"bot|crawl|spider|slurp|preview|headless|lighthouse|python-requests|curl|wget", re.I
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


class HandoffService:
    """Resolves a handoff and records an anonymous click (OR-032).

    Recording is best effort: a database failure is logged and the visitor still gets
    the handoff. An unknown or malformed product slug is stored as NULL.
    """

    def __init__(self, referrals: ReferralService, session: Session) -> None:
        self._referrals = referrals
        self._session = session

    def handoff(self, request: HandoffRequest, *, user_agent: str) -> ReferralHandoff:
        result = self._referrals.resolve()
        if BOT_USER_AGENT.search(user_agent):
            return result
        try:
            record(
                self._session,
                method=result.method,
                origin=request.origin,
                product_slug=self._known_slug(request.product_slug),
                item_count=request.item_count,
            )
            self._session.commit()
        except SQLAlchemyError as exc:
            self._session.rollback()
            logger.warning("referral_click_not_recorded", error_type=type(exc).__name__)
        return result

    def _known_slug(self, slug: str | None) -> str | None:
        if slug is None or not re.fullmatch(SLUG_PATTERN, slug):
            return None
        found = self._session.scalar(select(exists().where(Product.slug == slug)))
        return slug if found else None


def get_referral_service(
    config: Annotated[ConfigProvider, Depends(get_config_provider)],
) -> ReferralService:
    return ReferralService(config)


def get_handoff_service(
    referrals: Annotated[ReferralService, Depends(get_referral_service)],
    db: Annotated[Session, Depends(get_db)],
) -> HandoffService:
    return HandoffService(referrals, db)
