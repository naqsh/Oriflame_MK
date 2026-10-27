"""referral_clicks: record a handoff click and count clicks per day (OR-031)."""

from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from backend.app.models import ReferralClick

# Days are counted in Pakistan time, the store's only market.
REPORTING_TIMEZONE = "Asia/Karachi"
MAX_RANGE_DAYS = 366


@dataclass(frozen=True)
class DailyCount:
    day: date
    total: int
    by_method: dict[str, int] = field(default_factory=dict)


def record(
    session: Session,
    *,
    method: str,
    origin: str,
    product_slug: str | None,
    item_count: int,
) -> None:
    session.add(
        ReferralClick(
            method=method, origin=origin, product_slug=product_slug, item_count=item_count
        )
    )
    session.flush()


def daily_counts(session: Session, start: date, end: date) -> list[DailyCount]:
    """One entry per day from ``start`` to ``end`` inclusive, including days with 0."""
    if end < start:
        raise ValueError("end must not be before start")
    if (end - start).days >= MAX_RANGE_DAYS:
        raise ValueError(f"range must be at most {MAX_RANGE_DAYS} days")
    local_day = cast(func.timezone(REPORTING_TIMEZONE, ReferralClick.occurred_at), Date)
    rows = session.execute(
        select(local_day.label("day"), ReferralClick.method, func.count())
        .where(local_day >= start, local_day <= end)
        .group_by(local_day, ReferralClick.method)
    )
    per_day: dict[date, dict[str, int]] = {}
    for day, method, count in rows:
        per_day.setdefault(day, {})[method] = count
    days = [start + timedelta(days=offset) for offset in range((end - start).days + 1)]
    counts = []
    for day in days:
        by_method = per_day.get(day, {})
        counts.append(DailyCount(day=day, total=sum(by_method.values()), by_method=by_method))
    return counts


def origin_totals(session: Session, start: date, end: date) -> dict[str, int]:
    """Clicks per origin (pdp, list, referral_page) over the same Pakistan-time days."""
    local_day = cast(func.timezone(REPORTING_TIMEZONE, ReferralClick.occurred_at), Date)
    rows = session.execute(
        select(ReferralClick.origin, func.count())
        .where(local_day >= start, local_day <= end)
        .group_by(ReferralClick.origin)
    )
    return {origin: count for origin, count in rows}
