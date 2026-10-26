"""Product upserts keyed on source_id (OR-012). No HTTP or business logic.

Each upsert runs in its own savepoint: the product row, its images and its category
links change together or not at all. ``last_synced_at`` is always refreshed;
``updated_at`` moves only when a field, image or category link really changed.
Existing products keep their slug, so storefront URLs stay stable.
"""

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import delete, func, insert, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from backend.app.models import Product, ProductImage, product_categories
from backend.app.repositories.categories import category_ids_by_source
from backend.app.repositories.outcomes import WAS_INSERTED, UpsertOutcome, combine
from backend.app.repositories.slugs import new_slug
from backend.app.schemas.catalogue import ProductRecord

# Source-owned fields. Admin flags (is_visible, is_featured) and the slug are never
# overwritten by a sync.
_SYNCED_FIELDS = ("sku", "name", "description", "price_pkr", "source_url")


@dataclass
class ProductUpsertResult:
    product_id: int
    outcome: UpsertOutcome
    missing_categories: list[str] = field(default_factory=list)


def _upsert_row(
    session: Session, record: ProductRecord, synced_at: datetime
) -> tuple[int, UpsertOutcome]:
    slug = session.scalar(select(Product.slug).where(Product.source_id == record.source_id))
    if slug is None:
        slug = new_slug(
            session,
            name=record.name,
            source_id=record.source_id,
            slug_column=Product.slug,
            source_id_column=Product.source_id,
        )
    values = record.model_dump(include=set(_SYNCED_FIELDS))
    statement = pg_insert(Product).values(
        source_id=record.source_id, slug=slug, last_synced_at=synced_at, **values
    )
    excluded = statement.excluded
    upsert = statement.on_conflict_do_update(
        index_elements=[Product.source_id],
        set_={
            **{name: excluded[name] for name in _SYNCED_FIELDS},
            "last_synced_at": excluded.last_synced_at,
            "updated_at": func.now(),
        },
        where=tuple_(*(Product.__table__.c[n] for n in _SYNCED_FIELDS)).is_distinct_from(
            tuple_(*(excluded[n] for n in _SYNCED_FIELDS))
        ),
    ).returning(Product.id, WAS_INSERTED)
    row = session.execute(upsert).first()
    if row is not None:
        product_id, inserted = row
        return product_id, UpsertOutcome.CREATED if inserted else UpsertOutcome.UPDATED

    # Fields unchanged: refresh last_synced_at only, leaving updated_at alone.
    product_id = session.execute(
        update(Product)
        .where(Product.source_id == record.source_id)
        .values(last_synced_at=synced_at, updated_at=Product.updated_at)
        .returning(Product.id)
    ).scalar_one()
    return product_id, UpsertOutcome.UNCHANGED


def _replace_images(session: Session, product_id: int, record: ProductRecord) -> bool:
    """Replace the image list when it differs. Returns True if anything changed."""
    wanted = [
        (str(image.url), image.alt_text, str(image.source_url)) for image in record.unique_images()
    ]
    current = [
        tuple(row)
        for row in session.execute(
            select(ProductImage.url, ProductImage.alt_text, ProductImage.source_url)
            .where(ProductImage.product_id == product_id)
            .order_by(ProductImage.position)
        )
    ]
    if current == wanted:
        return False
    session.execute(delete(ProductImage).where(ProductImage.product_id == product_id))
    if wanted:
        session.execute(
            insert(ProductImage),
            [
                {
                    "product_id": product_id,
                    "url": url,
                    "alt_text": alt_text,
                    "source_url": source_url,
                    "position": position,
                }
                for position, (url, alt_text, source_url) in enumerate(wanted)
            ],
        )
    return True


def _reconcile_categories(
    session: Session, product_id: int, record: ProductRecord
) -> tuple[bool, list[str]]:
    """Link the product to exactly the known categories in the record.

    Unknown category ids are skipped and returned, never created here.
    """
    known = category_ids_by_source(session, record.category_source_ids)
    missing = [sid for sid in record.category_source_ids if sid not in known]
    wanted = set(known.values())
    current = set(
        session.scalars(
            select(product_categories.c.category_id).where(
                product_categories.c.product_id == product_id
            )
        )
    )
    if current == wanted:
        return False, missing
    stale = current - wanted
    if stale:
        session.execute(
            delete(product_categories).where(
                product_categories.c.product_id == product_id,
                product_categories.c.category_id.in_(stale),
            )
        )
    added = sorted(wanted - current)
    if added:
        session.execute(
            insert(product_categories),
            [{"product_id": product_id, "category_id": cid} for cid in added],
        )
    return True, missing


def upsert_product(
    session: Session, record: ProductRecord, *, synced_at: datetime
) -> ProductUpsertResult:
    with session.begin_nested():
        product_id, outcome = _upsert_row(session, record, synced_at)
        images_changed = _replace_images(session, product_id, record)
        links_changed, missing = _reconcile_categories(session, product_id, record)
        children_changed = images_changed or links_changed
        if outcome is UpsertOutcome.UNCHANGED and children_changed:
            session.execute(
                update(Product).where(Product.id == product_id).values(updated_at=func.now())
            )
        outcome = combine(outcome, children_changed=children_changed)
    return ProductUpsertResult(product_id=product_id, outcome=outcome, missing_categories=missing)
