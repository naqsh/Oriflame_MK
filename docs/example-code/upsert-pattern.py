"""Idempotent upsert keyed on a source id, with a created/updated/unchanged outcome.

A condensed version of ``backend/app/repositories/products.py`` (OR-012). Use it for
any table filled from an external source. See
docs/learning/2026-10-idempotent-catalogue-upserts.md for why each step is there.
"""

from datetime import datetime

from sqlalchemy import Boolean, func, literal_column, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from backend.app.models import Product
from backend.app.repositories.outcomes import UpsertOutcome
from backend.app.schemas.catalogue import ProductRecord

# Fields the source owns. Admin-owned columns (slug, is_visible, is_featured) are
# deliberately absent, so a sync never overwrites them.
SYNCED_FIELDS = ("sku", "name", "description", "price_pkr", "source_url")

# xmax = 0 only for a row this statement inserted. Fixed SQL, no user input.
WAS_INSERTED = literal_column("xmax = 0", type_=Boolean).label("inserted")


def upsert(
    session: Session, record: ProductRecord, *, source: str, slug: str, synced_at: datetime
) -> UpsertOutcome:
    values = record.model_dump(include=set(SYNCED_FIELDS))
    statement = insert(Product).values(
        source_id=record.source_id,
        source=source,
        slug=slug,
        last_synced_at=synced_at,
        **values,
    )
    excluded = statement.excluded
    upsert_statement = statement.on_conflict_do_update(
        index_elements=[Product.source_id],
        set_={
            **{name: excluded[name] for name in SYNCED_FIELDS},
            "last_synced_at": excluded.last_synced_at,
            "updated_at": func.now(),
        },
        # Only touch the row when something the source owns really changed.
        where=tuple_(*(Product.__table__.c[n] for n in SYNCED_FIELDS)).is_distinct_from(
            tuple_(*(excluded[n] for n in SYNCED_FIELDS))
        ),
    ).returning(WAS_INSERTED)

    with session.begin_nested():  # one savepoint per record: failures stay local
        inserted = session.execute(upsert_statement).scalar_one_or_none()
        if inserted is not None:
            return UpsertOutcome.CREATED if inserted else UpsertOutcome.UPDATED
        # Unchanged: record that the source still lists it, without moving updated_at.
        session.execute(
            update(Product)
            .where(Product.source_id == record.source_id)
            .values(last_synced_at=synced_at, updated_at=Product.updated_at)
        )
        return UpsertOutcome.UNCHANGED
