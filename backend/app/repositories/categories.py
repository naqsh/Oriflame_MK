"""Category upserts keyed on source_id (OR-012). No HTTP or business logic.

Parents are resolved in a second pass, so the order of records never causes a
foreign-key violation. A parent that is still unknown after the batch is left NULL
and reported, never invented. Existing categories keep their slug.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from backend.app.models import Category
from backend.app.repositories.outcomes import WAS_INSERTED, UpsertOutcome, combine
from backend.app.repositories.slugs import new_slug
from backend.app.schemas.catalogue import CategoryRecord


@dataclass
class CategoryBatchResult:
    outcomes: dict[str, UpsertOutcome] = field(default_factory=dict)
    missing_parents: dict[str, str] = field(default_factory=dict)  # child -> parent source id


def category_ids_by_source(session: Session, source_ids: Iterable[str]) -> dict[str, int]:
    wanted = sorted(set(source_ids))
    if not wanted:
        return {}
    rows = session.execute(
        select(Category.source_id, Category.id).where(Category.source_id.in_(wanted))
    )
    return {source_id: category_id for source_id, category_id in rows}


def _upsert_fields(session: Session, record: CategoryRecord) -> UpsertOutcome:
    slug = session.scalar(select(Category.slug).where(Category.source_id == record.source_id))
    if slug is None:
        slug = new_slug(
            session,
            name=record.name,
            source_id=record.source_id,
            slug_column=Category.slug,
            source_id_column=Category.source_id,
        )
    statement = insert(Category).values(source_id=record.source_id, slug=slug, name=record.name)
    upsert = statement.on_conflict_do_update(
        index_elements=[Category.source_id],
        set_={"name": statement.excluded.name},
        where=Category.name.is_distinct_from(statement.excluded.name),
    ).returning(WAS_INSERTED)
    inserted = session.execute(upsert).scalar_one_or_none()
    if inserted is None:
        return UpsertOutcome.UNCHANGED
    return UpsertOutcome.CREATED if inserted else UpsertOutcome.UPDATED


def _set_parent(session: Session, source_id: str, parent_id: int | None) -> bool:
    changed = session.execute(
        update(Category)
        .where(Category.source_id == source_id, Category.parent_id.is_distinct_from(parent_id))
        .values(parent_id=parent_id)
        .returning(Category.id)
    ).first()
    return changed is not None


def upsert_categories(session: Session, records: Sequence[CategoryRecord]) -> CategoryBatchResult:
    """Upsert a batch atomically (one savepoint): names first, then parent links."""
    result = CategoryBatchResult()
    with session.begin_nested():
        for record in records:
            result.outcomes[record.source_id] = _upsert_fields(session, record)

        parent_ids = category_ids_by_source(
            session, (r.parent_source_id for r in records if r.parent_source_id)
        )
        for record in records:
            parent_id = None
            if record.parent_source_id:
                parent_id = parent_ids.get(record.parent_source_id)
                if parent_id is None:
                    result.missing_parents[record.source_id] = record.parent_source_id
            changed = _set_parent(session, record.source_id, parent_id)
            result.outcomes[record.source_id] = combine(
                result.outcomes[record.source_id], children_changed=changed
            )
    return result
