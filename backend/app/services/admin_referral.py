"""Referral setup status and handoff-click counts for the admin area (OR-049).

Read-only: referral settings are changed through deployment environment settings, not
here. The consultant code is masked (last two characters) and the referral URL is
reduced to its host. Counts are handoff clicks, never sales or conversions.
"""

from dataclasses import dataclass
from datetime import date
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.core.config import ConfigProvider, get_config_provider
from backend.app.db.session import get_db
from backend.app.repositories import referral_clicks
from backend.app.repositories.referral_clicks import DailyCount
from backend.app.schemas.referral import ReferralStatus
from backend.app.services.referral import ReferralService

MASK_VISIBLE = 2


def mask_code(code: str) -> str:
    if len(code) <= MASK_VISIBLE * 2:
        return "•" * len(code)
    return "•" * (len(code) - MASK_VISIBLE) + code[-MASK_VISIBLE:]


@dataclass(frozen=True)
class ReferralSetup:
    method: str
    status: ReferralStatus
    referral_host: str | None
    masked_code: str | None


@dataclass(frozen=True)
class ClickReport:
    days: list[DailyCount]
    by_origin: dict[str, int]
    total: int


class AdminReferralService:
    def __init__(self, session: Session, config: ConfigProvider) -> None:
        self._session = session
        self._config = config

    def setup(self) -> ReferralSetup:
        referral = self._config.get_referral_config()
        url = str(referral.referral_url) if referral.referral_url is not None else None
        code = referral.consultant_code
        return ReferralSetup(
            method=referral.method,
            status=ReferralService(self._config).status(),
            referral_host=urlsplit(url).hostname if url else None,
            masked_code=mask_code(code.get_secret_value()) if code is not None else None,
        )

    def clicks(self, start: date, end: date) -> ClickReport:
        """Raises ValueError for a reversed range or one longer than 366 days."""
        days = referral_clicks.daily_counts(self._session, start, end)
        by_origin = referral_clicks.origin_totals(self._session, start, end)
        return ClickReport(days=days, by_origin=by_origin, total=sum(d.total for d in days))


def get_admin_referral_service(
    db: Annotated[Session, Depends(get_db)],
    config: Annotated[ConfigProvider, Depends(get_config_provider)],
) -> AdminReferralService:
    return AdminReferralService(db, config)
