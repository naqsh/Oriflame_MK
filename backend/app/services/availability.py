"""Honest availability labels (OR-018 minimal; OR-021 completes the service).

No catalogue source provides availability (ADR-001; no availability table exists), so
every product is ``not_confirmed``. No page may describe stock it cannot verify.
"""

from typing import Literal

from backend.app.models import Product
from backend.app.schemas.products import Availability

NOT_CONFIRMED_LABEL = "Availability not confirmed"
CHECK_AT_ORIFLAME_LABEL = "Check availability at Oriflame"

AvailabilityContext = Literal["list", "detail"]


def availability_for(product: Product, context: AvailabilityContext = "list") -> Availability:
    label = CHECK_AT_ORIFLAME_LABEL if context == "detail" else NOT_CONFIRMED_LABEL
    return Availability(status="not_confirmed", label=label, checked_at=None)
