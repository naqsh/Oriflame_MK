"""Honest availability labels (OR-021). The only place availability wording is decided.

- ``verified_in_stock`` / ``verified_out_of_stock`` only for a source snapshot newer
  than the freshness window (``AVAILABILITY_MAX_AGE_HOURS``, default 24 hours).
- Anything else, including stale or future-dated snapshots, is ``not_confirmed``:
  "Availability not confirmed" in lists, "Check availability at Oriflame" on detail.
- Labels say "when last checked" with the check time, never "now" or "live": no
  source is real-time, and ADR-001 accepts none.
- Stock quantities may arrive in a snapshot but are never returned.

No catalogue source provides availability today (ADR-001; there is no availability
table), so ``snapshot_for`` returns None and every product is ``not_confirmed``. When
a permitted source does, store its checks and return them from ``snapshot_for``.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from backend.app.models import Product
from backend.app.schemas.products import Availability

NOT_CONFIRMED_LABEL = "Availability not confirmed"
CHECK_AT_ORIFLAME_LABEL = "Check availability at Oriflame"
IN_STOCK_LABEL = "In stock at Oriflame when last checked"
OUT_OF_STOCK_LABEL = "Out of stock at Oriflame when last checked"
DEFAULT_MAX_AGE = timedelta(hours=24)

AvailabilityContext = Literal["list", "detail"]


@dataclass(frozen=True)
class AvailabilitySnapshot:
    """One availability check reported by a permitted source."""

    in_stock: bool
    checked_at: datetime
    quantity: int | None = None  # kept for internal use only; never returned


@dataclass(frozen=True)
class AvailabilityPolicy:
    max_age: timedelta = DEFAULT_MAX_AGE


def snapshot_for(product: Product) -> AvailabilitySnapshot | None:
    """The latest source availability check for a product. None until a source has one."""
    return None


def describe(
    snapshot: AvailabilitySnapshot | None,
    *,
    context: AvailabilityContext,
    policy: AvailabilityPolicy,
    now: datetime | None = None,
) -> Availability:
    current = now or datetime.now(UTC)
    if snapshot is not None and _is_fresh(snapshot.checked_at, current, policy.max_age):
        if snapshot.in_stock:
            return Availability(
                status="verified_in_stock", label=IN_STOCK_LABEL, checked_at=snapshot.checked_at
            )
        return Availability(
            status="verified_out_of_stock",
            label=OUT_OF_STOCK_LABEL,
            checked_at=snapshot.checked_at,
        )
    label = CHECK_AT_ORIFLAME_LABEL if context == "detail" else NOT_CONFIRMED_LABEL
    return Availability(status="not_confirmed", label=label, checked_at=None)


def _is_fresh(checked_at: datetime, now: datetime, max_age: timedelta) -> bool:
    if checked_at.tzinfo is None:  # a naive time cannot be trusted
        return False
    age = now - checked_at
    return timedelta(0) <= age <= max_age  # a future check time is not trusted either


def availability_for(
    product: Product,
    context: AvailabilityContext = "list",
    policy: AvailabilityPolicy | None = None,
) -> Availability:
    return describe(snapshot_for(product), context=context, policy=policy or AvailabilityPolicy())
