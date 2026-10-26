"""Upsert outcomes and helpers shared by the catalogue repositories."""

import enum

from sqlalchemy import Boolean, ColumnElement, literal_column

# In RETURNING after INSERT ... ON CONFLICT DO UPDATE, xmax is 0 only for a freshly
# inserted row (an updated row carries the locking transaction id). Fixed SQL, no input.
WAS_INSERTED: ColumnElement[bool] = literal_column("xmax = 0", type_=Boolean).label("inserted")


class UpsertOutcome(enum.StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    UNCHANGED = "unchanged"


def combine(outcome: UpsertOutcome, *, children_changed: bool) -> UpsertOutcome:
    """A row whose own fields are unchanged is still 'updated' if its children changed."""
    if outcome is UpsertOutcome.UNCHANGED and children_changed:
        return UpsertOutcome.UPDATED
    return outcome
