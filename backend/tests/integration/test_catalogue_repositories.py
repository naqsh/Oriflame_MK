"""Catalogue repositories against real PostgreSQL (OR-012)."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import Engine, event, func, select, update
from sqlalchemy.orm import Session

from backend.app.models import CatalogueSyncRun, Category, Product, ProductImage, SyncRunStatus
from backend.app.repositories import products as products_repo
from backend.app.repositories.categories import upsert_categories
from backend.app.repositories.outcomes import UpsertOutcome
from backend.app.repositories.products import hide_products_missing_from, upsert_product
from backend.app.repositories.sync_runs import (
    ERROR_DETAIL_MAX_LENGTH,
    SyncAlreadyRunningError,
    SyncCounts,
    catalogue_sync_lock,
    fail_stale_runs,
    finish_run,
    start_run,
)
from backend.app.schemas.catalogue import CategoryRecord, ImageRecord, ProductRecord

pytestmark = pytest.mark.db

FIRST_SYNC = datetime(2026, 10, 26, 8, 0, tzinfo=UTC)
SECOND_SYNC = FIRST_SYNC + timedelta(hours=6)
LONG_AGO = datetime(2020, 1, 1, tzinfo=UTC)
SOURCE = "test_source"


def _image(name: str, alt: str = "Fixture image") -> ImageRecord:
    return ImageRecord(
        url=f"https://example.test/img/{name}.jpg",
        alt_text=alt,
        source_url="https://example.test/products/p1",
    )


def _record(**overrides: Any) -> ProductRecord:
    fields: dict[str, Any] = {
        "source_id": "p1",
        "name": "Fixture Peach Glow",
        "source_url": "https://example.test/products/p1",
        "sku": "SKU-1",
        "description": "Development fixture, not real Oriflame data.",
        "price_pkr": Decimal("1499.00"),
        "images": (_image("a"), _image("b")),
    }
    fields.update(overrides)
    return ProductRecord(**fields)


def _count(session: Session, model: type[Any]) -> int:
    return session.scalar(select(func.count()).select_from(model)) or 0


def _product(session: Session, source_id: str = "p1") -> Product:
    session.expire_all()
    return session.scalars(select(Product).where(Product.source_id == source_id)).one()


def _age_updated_at(session: Session) -> None:
    """now() is fixed inside the test transaction, so backdate to observe changes."""
    session.execute(update(Product).values(updated_at=LONG_AGO))


def _image_urls(session: Session) -> list[str]:
    return list(session.scalars(select(ProductImage.url).order_by(ProductImage.position)))


# --- Products -------------------------------------------------------------------------


def test_same_record_twice_creates_one_row_then_unchanged(db_session: Session) -> None:
    first = upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    _age_updated_at(db_session)
    second = upsert_product(db_session, _record(), source=SOURCE, synced_at=SECOND_SYNC)

    assert (first.outcome, second.outcome) == (UpsertOutcome.CREATED, UpsertOutcome.UNCHANGED)
    assert first.product_id == second.product_id
    assert _count(db_session, Product) == 1
    assert _count(db_session, ProductImage) == 2
    product = _product(db_session)
    assert product.last_synced_at == SECOND_SYNC  # always refreshed
    assert product.updated_at == LONG_AGO  # untouched without a real change


def test_changed_price_is_updated_and_persisted(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    _age_updated_at(db_session)

    cheaper = _record(price_pkr=Decimal("1299.50"))
    result = upsert_product(db_session, cheaper, source=SOURCE, synced_at=SECOND_SYNC)

    assert result.outcome is UpsertOutcome.UPDATED
    product = _product(db_session)
    assert product.price_pkr == Decimal("1299.50")
    assert product.updated_at != LONG_AGO
    assert product.last_synced_at == SECOND_SYNC


def test_price_removed_by_source_becomes_null(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    result = upsert_product(
        db_session, _record(price_pkr=None), source=SOURCE, synced_at=SECOND_SYNC
    )
    assert result.outcome is UpsertOutcome.UPDATED
    assert _product(db_session).price_pkr is None


def test_image_list_changes_are_reflected_exactly(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    _age_updated_at(db_session)

    reordered = _record(images=(_image("c"), _image("a")))
    result = upsert_product(db_session, reordered, source=SOURCE, synced_at=SECOND_SYNC)

    assert result.outcome is UpsertOutcome.UPDATED  # only the images changed
    assert _image_urls(db_session) == [
        "https://example.test/img/c.jpg",
        "https://example.test/img/a.jpg",
    ]
    assert _product(db_session).updated_at != LONG_AGO


def test_alt_text_change_counts_as_update(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    changed = _record(images=(_image("a", alt="Better alt text"), _image("b")))
    assert upsert_product(db_session, changed, source=SOURCE, synced_at=SECOND_SYNC).outcome is (
        UpsertOutcome.UPDATED
    )


def test_repeated_upserts_never_duplicate_images(db_session: Session) -> None:
    record = _record(images=(_image("a"), _image("b"), _image("a")))
    for _ in range(3):
        upsert_product(db_session, record, source=SOURCE, synced_at=FIRST_SYNC)
    assert _image_urls(db_session) == [
        "https://example.test/img/a.jpg",
        "https://example.test/img/b.jpg",
    ]


def test_removing_all_images(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    upsert_product(db_session, _record(images=()), source=SOURCE, synced_at=SECOND_SYNC)
    assert _count(db_session, ProductImage) == 0


def test_category_links_are_reconciled(db_session: Session) -> None:
    upsert_categories(
        db_session,
        [CategoryRecord(source_id=s, name=f"Category {s}") for s in ("c1", "c2", "c3")],
    )
    upsert_product(
        db_session, _record(category_source_ids=["c1", "c2"]), source=SOURCE, synced_at=FIRST_SYNC
    )
    _age_updated_at(db_session)

    result = upsert_product(
        db_session, _record(category_source_ids=["c2", "c3"]), source=SOURCE, synced_at=SECOND_SYNC
    )

    assert result.outcome is UpsertOutcome.UPDATED
    linked = {c.source_id for c in _product(db_session).categories}
    assert linked == {"c2", "c3"}
    assert _count(db_session, Category) == 3  # unlinking never deletes a category


def test_unknown_category_is_reported_not_created(db_session: Session) -> None:
    upsert_categories(db_session, [CategoryRecord(source_id="c1", name="Skincare")])

    result = upsert_product(
        db_session,
        _record(category_source_ids=["c1", "not-yet"]),
        source=SOURCE,
        synced_at=FIRST_SYNC,
    )

    assert result.outcome is UpsertOutcome.CREATED
    assert result.missing_categories == ["not-yet"]
    assert _count(db_session, Category) == 1
    assert [c.source_id for c in _product(db_session).categories] == ["c1"]


def test_slug_is_stable_when_the_name_changes(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    upsert_product(
        db_session, _record(name="Renamed Fixture"), source=SOURCE, synced_at=SECOND_SYNC
    )
    product = _product(db_session)
    assert (product.name, product.slug) == ("Renamed Fixture", "fixture-peach-glow")


def test_slug_collision_between_source_products_gets_source_suffix(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    upsert_product(
        db_session,
        _record(source_id="p2", source_url="https://example.test/products/p2"),
        source=SOURCE,
        synced_at=FIRST_SYNC,
    )
    assert _product(db_session, "p2").slug == "fixture-peach-glow-p2"


def test_admin_flags_survive_a_sync(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    db_session.execute(update(Product).values(is_visible=False, is_featured=True))

    upsert_product(db_session, _record(name="Changed"), source=SOURCE, synced_at=SECOND_SYNC)

    product = _product(db_session)
    assert (product.is_visible, product.is_featured) == (False, True)


def test_failed_upsert_rolls_back_only_that_product(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)

    def broken(*_: object) -> bool:
        raise RuntimeError("simulated failure while writing images")

    monkeypatch.setattr(products_repo, "_replace_images", broken)
    second = _record(source_id="p2", source_url="https://example.test/products/p2")
    with pytest.raises(RuntimeError):
        upsert_product(db_session, second, source=SOURCE, synced_at=FIRST_SYNC)

    db_session.expire_all()
    assert [p.source_id for p in db_session.scalars(select(Product))] == ["p1"]
    assert _count(db_session, ProductImage) == 2


def test_record_values_are_bound_parameters_never_sql_text(
    db_session: Session, migrated_engine: Engine
) -> None:
    hostile = "Robert'); DROP TABLE products;--"
    statements: list[str] = []

    def capture(_conn: object, _cursor: object, statement: str, *_: object) -> None:
        statements.append(statement)

    bind = db_session.get_bind()
    event.listen(bind, "before_cursor_execute", capture)
    try:
        upsert_categories(db_session, [CategoryRecord(source_id="c-" + hostile, name=hostile)])
        upsert_product(
            db_session,
            _record(name=hostile, description=hostile, category_source_ids=["c-" + hostile]),
            source=SOURCE,
            synced_at=FIRST_SYNC,
        )
    finally:
        event.remove(bind, "before_cursor_execute", capture)

    assert statements
    assert not [s for s in statements if "DROP TABLE" in s]
    assert _product(db_session).name == hostile


# --- Categories -----------------------------------------------------------------------


def test_child_before_parent_links_without_fk_violation(db_session: Session) -> None:
    result = upsert_categories(
        db_session,
        [
            CategoryRecord(source_id="child", name="Face cream", parent_source_id="parent"),
            CategoryRecord(source_id="parent", name="Face"),
        ],
    )

    assert result.outcomes == {"child": UpsertOutcome.CREATED, "parent": UpsertOutcome.CREATED}
    assert result.missing_parents == {}
    db_session.expire_all()
    child = db_session.scalars(select(Category).where(Category.source_id == "child")).one()
    assert child.parent is not None
    assert child.parent.source_id == "parent"


def test_unknown_parent_is_left_null_and_reported(db_session: Session) -> None:
    result = upsert_categories(
        db_session, [CategoryRecord(source_id="orphan", name="Orphan", parent_source_id="nope")]
    )
    assert result.missing_parents == {"orphan": "nope"}
    assert db_session.scalars(select(Category.parent_id)).one() is None


def test_category_batch_outcomes(db_session: Session) -> None:
    batch = [
        CategoryRecord(source_id="face", name="Face"),
        CategoryRecord(source_id="cream", name="Cream", parent_source_id="face"),
    ]
    upsert_categories(db_session, batch)
    again = upsert_categories(db_session, batch)
    assert set(again.outcomes.values()) == {UpsertOutcome.UNCHANGED}

    changed = upsert_categories(
        db_session,
        [
            CategoryRecord(source_id="face", name="Face care"),
            CategoryRecord(source_id="cream", name="Cream"),  # parent removed
        ],
    )
    assert changed.outcomes == {"face": UpsertOutcome.UPDATED, "cream": UpsertOutcome.UPDATED}
    assert _count(db_session, Category) == 2


def test_category_slug_collision_and_stability(db_session: Session) -> None:
    upsert_categories(
        db_session,
        [
            CategoryRecord(source_id="a", name="Skin Care"),
            CategoryRecord(source_id="b", name="Skin-care"),
        ],
    )
    upsert_categories(db_session, [CategoryRecord(source_id="a", name="Renamed")])
    rows = db_session.execute(select(Category.source_id, Category.slug))
    slugs = {source_id: slug for source_id, slug in rows}
    assert slugs == {"a": "skin-care", "b": "skin-care-b"}


# --- Sync runs ------------------------------------------------------------------------


def test_run_is_started_and_finished_with_counts(db_session: Session) -> None:
    run = start_run(db_session, "dev_fixtures")
    assert run.status is SyncRunStatus.RUNNING

    finish_run(
        db_session,
        run,
        status=SyncRunStatus.PARTIAL,
        counts=SyncCounts(created=3, updated=2, unchanged=5, errors=1),
        error_detail="p9: missing name",
    )

    db_session.expire_all()
    stored = db_session.get_one(CatalogueSyncRun, run.id)
    assert stored.status is SyncRunStatus.PARTIAL
    assert stored.finished_at is not None
    counts = (
        stored.created_count,
        stored.updated_count,
        stored.unchanged_count,
        stored.error_count,
    )
    assert counts == (3, 2, 5, 1)
    assert stored.error_detail == "p9: missing name"


def test_long_error_detail_is_truncated(db_session: Session) -> None:
    run = start_run(db_session, "dev_fixtures")
    finish_run(
        db_session, run, status=SyncRunStatus.FAILED, counts=SyncCounts(), error_detail="x" * 9000
    )
    assert run.error_detail is not None
    assert len(run.error_detail) == ERROR_DETAIL_MAX_LENGTH
    assert run.error_detail.endswith("[truncated]")


def test_finishing_as_running_is_refused(db_session: Session) -> None:
    run = start_run(db_session, "dev_fixtures")
    with pytest.raises(ValueError, match="final status"):
        finish_run(db_session, run, status=SyncRunStatus.RUNNING, counts=SyncCounts())


def test_stale_running_runs_are_failed(db_session: Session) -> None:
    stale = start_run(db_session, "dev_fixtures")
    fresh = start_run(db_session, "dev_fixtures")
    db_session.execute(
        update(CatalogueSyncRun).where(CatalogueSyncRun.id == stale.id).values(started_at=LONG_AGO)
    )

    assert fail_stale_runs(db_session, started_before=FIRST_SYNC) == 1

    db_session.expire_all()
    assert db_session.get_one(CatalogueSyncRun, stale.id).status is SyncRunStatus.FAILED
    assert db_session.get_one(CatalogueSyncRun, fresh.id).status is SyncRunStatus.RUNNING


def test_second_concurrent_sync_is_refused(migrated_engine: Engine) -> None:
    with (
        catalogue_sync_lock(migrated_engine),
        pytest.raises(SyncAlreadyRunningError, match="already running"),
        catalogue_sync_lock(migrated_engine),
    ):
        pytest.fail("second sync acquired the lock")
    with catalogue_sync_lock(migrated_engine):  # released after the first sync ends
        pass


def test_lock_is_released_when_the_sync_raises(migrated_engine: Engine) -> None:
    with pytest.raises(RuntimeError), catalogue_sync_lock(migrated_engine):
        raise RuntimeError("sync crashed")
    with catalogue_sync_lock(migrated_engine):
        pass


def test_hiding_with_an_empty_source_list_is_refused(db_session: Session) -> None:
    upsert_product(db_session, _record(), source=SOURCE, synced_at=FIRST_SYNC)
    with pytest.raises(ValueError, match="Refusing to hide every product"):
        hide_products_missing_from(db_session, SOURCE, set())
    assert _product(db_session).is_visible is True
