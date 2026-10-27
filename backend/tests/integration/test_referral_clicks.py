"""referral_clicks storage and daily counts against real PostgreSQL (OR-031)."""

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import Engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.models import ReferralClick
from backend.app.repositories.referral_clicks import DailyCount, daily_counts, record

pytestmark = pytest.mark.db


def _click(session: Session, when: datetime, method: str = "official_url") -> None:
    session.add(ReferralClick(occurred_at=when, method=method, origin="pdp", item_count=1))
    session.flush()


def test_record_stores_only_anonymous_fields(db_session: Session) -> None:
    record(db_session, method="manual_code", origin="list", product_slug=None, item_count=3)

    click = db_session.scalars(select(ReferralClick)).one()
    assert (click.method, click.origin, click.product_slug, click.item_count) == (
        "manual_code",
        "list",
        None,
        3,
    )
    assert click.occurred_at is not None


def test_schema_has_no_personal_data_columns(migrated_engine: Engine) -> None:
    columns = {c["name"] for c in inspect(migrated_engine).get_columns("referral_clicks")}
    assert columns == {"id", "occurred_at", "method", "origin", "product_slug", "item_count"}
    forbidden = ("ip", "agent", "user", "session", "cookie", "email", "phone", "address", "name")
    assert not [c for c in columns if any(word in c for word in forbidden) and c != "id"]


def test_rls_is_enabled(migrated_engine: Engine) -> None:
    with migrated_engine.connect() as connection:
        enabled = connection.execute(
            text("SELECT relrowsecurity FROM pg_class WHERE relname = 'referral_clicks'")
        ).scalar_one()
    assert enabled is True


@pytest.mark.parametrize(
    "fields",
    [
        {"method": "affiliate_link"},
        {"origin": "email"},
        {"item_count": -1},
        {"item_count": 201},
    ],
)
def test_constraints_reject_unknown_values(db_session: Session, fields: dict[str, object]) -> None:
    values: dict[str, object] = {"method": "official_url", "origin": "pdp", "item_count": 0}
    values.update(fields)
    db_session.add(ReferralClick(**values))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_daily_counts_aggregate_across_days_in_pakistan_time(db_session: Session) -> None:
    # 2026-10-26 19:30 UTC is already 2026-10-27 00:30 in Karachi (UTC+5).
    _click(db_session, datetime(2026, 10, 26, 10, 0, tzinfo=UTC))
    _click(db_session, datetime(2026, 10, 26, 18, 59, tzinfo=UTC), method="manual_code")
    _click(db_session, datetime(2026, 10, 26, 19, 30, tzinfo=UTC))
    _click(db_session, datetime(2026, 10, 28, 9, 0, tzinfo=UTC), method="unavailable")
    _click(db_session, datetime(2026, 11, 5, 9, 0, tzinfo=UTC))  # outside the range

    counts = daily_counts(db_session, date(2026, 10, 26), date(2026, 10, 28))

    assert counts == [
        DailyCount(date(2026, 10, 26), 2, {"official_url": 1, "manual_code": 1}),
        DailyCount(date(2026, 10, 27), 1, {"official_url": 1}),
        DailyCount(date(2026, 10, 28), 1, {"unavailable": 1}),
    ]


def test_daily_counts_include_empty_days(db_session: Session) -> None:
    assert daily_counts(db_session, date(2026, 1, 1), date(2026, 1, 2)) == [
        DailyCount(date(2026, 1, 1), 0, {}),
        DailyCount(date(2026, 1, 2), 0, {}),
    ]


@pytest.mark.parametrize(
    "start, end, message",
    [
        (date(2026, 2, 2), date(2026, 2, 1), "before start"),
        (date(2025, 1, 1), date(2026, 1, 2), "at most 366 days"),
    ],
)
def test_daily_counts_reject_bad_ranges(
    db_session: Session, start: date, end: date, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        daily_counts(db_session, start, end)
