"""Referral handoff clicks for basic analytics (OR-031).

Deliberately anonymous: no IP address, user agent, session, cookie or any other
identifier is stored; only what was clicked, where and when.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base

REFERRAL_METHODS = ("official_url", "manual_code", "unavailable")
HANDOFF_ORIGINS = ("pdp", "list", "referral_page")
MAX_ITEM_COUNT = 200


def _in(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"


class ReferralClick(Base):
    __tablename__ = "referral_clicks"
    __table_args__ = (
        CheckConstraint(_in("method", REFERRAL_METHODS), name="method_known"),
        CheckConstraint(_in("origin", HANDOFF_ORIGINS), name="origin_known"),
        CheckConstraint(f"item_count BETWEEN 0 AND {MAX_ITEM_COUNT}", name="item_count_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    method: Mapped[str] = mapped_column(String(20))
    origin: Mapped[str] = mapped_column(String(20))
    # A product slug that existed when clicked, or NULL (list and referral-page clicks,
    # or an unknown slug).
    product_slug: Mapped[str | None] = mapped_column(String(200))
    item_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
