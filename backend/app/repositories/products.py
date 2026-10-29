"""Product upserts keyed on source_id (OR-012). No HTTP or business logic.

Each upsert runs in its own savepoint: the product row, its images and its category
links change together or not at all. ``last_synced_at`` is always refreshed;
``updated_at`` moves only when a field, image or category link really changed.
Existing products keep their slug, so storefront URLs stay stable.
"""

from collections.abc import Collection
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

# Source-owned fields. Owner flags (is_visible, is_featured) and the slug are never
# written by a sync; the sync owns listed_by_source instead (OR-048).
_SYNCED_FIELDS = ("sku", "name", "description", "price_pkr", "source_url")


@dataclass
class ProductUpsertResult:
    product_id: int
    outcome: UpsertOutcome
    missing_categories: list[str] = field(default_factory=list)


def _upsert_row(
    session: Session, record: ProductRecord, source: str, synced_at: datetime
) -> tuple[int, UpsertOutcome]:
    existing = session.execute(
        select(Product.slug, Product.listed_by_source).where(Product.source_id == record.source_id)
    ).first()
    slug = existing.slug if existing else None
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
        source_id=record.source_id,
        source=source,
        slug=slug,
        last_synced_at=synced_at,
        **values,
    )
    excluded = statement.excluded
    upsert = statement.on_conflict_do_update(
        index_elements=[Product.source_id],
        set_={
            **{name: excluded[name] for name in _SYNCED_FIELDS},
            "last_synced_at": excluded.last_synced_at,
            "listed_by_source": True,
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

    # Fields unchanged: refresh last_synced_at, and list the product again if the source
    # had dropped it. updated_at only moves for a re-listing.
    relisted = existing is not None and not existing.listed_by_source
    product_id = session.execute(
        update(Product)
        .where(Product.source_id == record.source_id)
        .values(
            last_synced_at=synced_at,
            listed_by_source=True,
            updated_at=func.now() if relisted else Product.updated_at,
        )
        .returning(Product.id)
    ).scalar_one()
    return product_id, UpsertOutcome.UPDATED if relisted else UpsertOutcome.UNCHANGED


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


def other_sources_present(session: Session, source: str) -> list[str]:
    """Names of other catalogue sources that already have products."""
    return sorted(
        session.scalars(select(Product.source).where(Product.source != source).distinct())
    )


def upsert_product(
    session: Session, record: ProductRecord, *, source: str, synced_at: datetime
) -> ProductUpsertResult:
    with session.begin_nested():
        product_id, outcome = _upsert_row(session, record, source, synced_at)
        images_changed = _replace_images(session, product_id, record)
        links_changed, missing = _reconcile_categories(session, product_id, record)
        children_changed = images_changed or links_changed
        if outcome is UpsertOutcome.UNCHANGED and children_changed:
            session.execute(
                update(Product).where(Product.id == product_id).values(updated_at=func.now())
            )
        outcome = combine(outcome, children_changed=children_changed)
    return ProductUpsertResult(product_id=product_id, outcome=outcome, missing_categories=missing)


def hide_products_missing_from(
    session: Session, source: str, seen_source_ids: Collection[str]
) -> list[str]:
    """Mark products of ``source`` that it no longer lists as unlisted. Never deletes.

    Only ``listed_by_source`` changes; the owner's flags are left alone, so a product the
    source lists again reappears as the owner left it. Products from other sources are
    never touched. Returns the newly unlisted source ids.

    An empty ``seen_source_ids`` would hide the whole catalogue, so it is refused.
    """
    if not seen_source_ids:
        raise ValueError("Refusing to hide every product: the source listed none.")
    hidden = session.scalars(
        update(Product)
        .where(
            Product.source == source,
            Product.listed_by_source.is_(True),
            Product.source_id.not_in(list(seen_source_ids)),
        )
        .values(listed_by_source=False, updated_at=func.now())
        .returning(Product.source_id)
    )
    return sorted(hidden)
