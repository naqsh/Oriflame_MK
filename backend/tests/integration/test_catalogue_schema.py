"""Catalogue schema constraints against real PostgreSQL (OR-011)."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import Engine, func, inspect, select, text
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

from backend.app.models import (
    CatalogueSyncRun,
    Category,
    Product,
    ProductImage,
    SyncRunStatus,
    product_categories,
)

pytestmark = pytest.mark.db

CATALOGUE_TABLES = {
    "catalogue_sync_runs",
    "categories",
    "products",
    "product_categories",
    "product_images",
}
SYNCED_AT = datetime(2026, 10, 26, tzinfo=UTC)


def _product(source_id: str, slug: str, **overrides: object) -> Product:
    fields: dict[str, object] = {
        "source_id": source_id,
        "source": "test_source",
        "slug": slug,
        "name": f"Fixture product {source_id}",
        "source_url": f"https://example.test/products/{source_id}",
        "last_synced_at": SYNCED_AT,
    }
    fields.update(overrides)
    return Product(**fields)


def test_catalogue_tables_exist(migrated_engine: Engine) -> None:
    assert set(inspect(migrated_engine).get_table_names()) >= CATALOGUE_TABLES


def test_rls_enabled_on_catalogue_tables(migrated_engine: Engine) -> None:
    with migrated_engine.connect() as connection:
        protected = connection.execute(
            text(
                "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity"
            )
        ).scalars()
        assert set(protected) >= CATALOGUE_TABLES


def test_no_tenant_or_variant_tables_or_columns(migrated_engine: Engine) -> None:
    inspector = inspect(migrated_engine)
    tables = set(inspector.get_table_names())
    forbidden = ("tenant", "vendor", "billing", "variant", "availability")
    assert not [t for t in tables if any(word in t for word in forbidden)]
    columns = [c["name"] for table in tables for c in inspector.get_columns(table)]
    assert not [c for c in columns if any(word in c for word in ("tenant", "vendor"))]


def test_product_defaults_and_null_price(db_session: Session) -> None:
    product = _product("src-1", "fixture-one")
    db_session.add(product)
    db_session.flush()
    db_session.refresh(product)

    assert product.price_pkr is None  # absent price stays NULL, never 0
    assert product.currency == "PKR"
    assert product.is_visible is True
    assert product.is_featured is False
    assert product.created_at is not None
    assert product.updated_at is not None


@pytest.mark.parametrize(
    "first, second",
    [
        (("src-1", "same-slug"), ("src-2", "same-slug")),
        (("same-src", "slug-a"), ("same-src", "slug-b")),
    ],
    ids=["duplicate-slug", "duplicate-source-id"],
)
def test_product_unique_constraints(
    db_session: Session, first: tuple[str, str], second: tuple[str, str]
) -> None:
    db_session.add(_product(*first))
    db_session.flush()
    db_session.add(_product(*second))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_category_unique_slug(db_session: Session) -> None:
    db_session.add(Category(source_id="c1", slug="skincare", name="Skincare"))
    db_session.flush()
    db_session.add(Category(source_id="c2", slug="skincare", name="Skin care"))
    with pytest.raises(IntegrityError):
        db_session.flush()


@pytest.mark.parametrize("price", [Decimal("0"), Decimal("-1.00")])
def test_price_must_be_positive_when_present(db_session: Session, price: Decimal) -> None:
    db_session.add(_product("src-1", "fixture-one", price_pkr=price))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_currency_is_pkr_only(db_session: Session) -> None:
    db_session.add(_product("src-1", "fixture-one", currency="USD"))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_deleting_product_cascades_images_but_keeps_categories(db_session: Session) -> None:
    category = Category(source_id="c1", slug="skincare", name="Skincare")
    product = _product("src-1", "fixture-one", categories=[category])
    product.images.append(
        ProductImage(
            url="https://example.test/img.jpg",
            alt_text="Fixture image",
            source_url="https://example.test/products/src-1",
        )
    )
    other = _product("src-2", "fixture-two", categories=[category])
    db_session.add_all([product, other])
    db_session.flush()

    db_session.execute(text("DELETE FROM products WHERE source_id = 'src-1'"))
    db_session.expire_all()

    assert db_session.scalar(select(func.count()).select_from(ProductImage)) == 0
    assert db_session.scalar(select(func.count()).select_from(Category)) == 1
    links = db_session.scalar(select(func.count()).select_from(product_categories))
    assert links == 1  # only the surviving product's membership remains


def test_deleting_parent_category_keeps_child(db_session: Session) -> None:
    parent = Category(source_id="c1", slug="face", name="Face")
    child = Category(source_id="c2", slug="face-cream", name="Face cream", parent=parent)
    db_session.add_all([parent, child])
    db_session.flush()

    db_session.execute(text("DELETE FROM categories WHERE source_id = 'c1'"))
    db_session.expire_all()

    assert db_session.scalars(select(Category)).one().parent_id is None


def test_image_position_unique_per_product(db_session: Session) -> None:
    product = _product("src-1", "fixture-one")
    for _ in range(2):
        product.images.append(
            ProductImage(url="https://example.test/a.jpg", alt_text="A", source_url="x")
        )
    db_session.add(product)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_sync_run_defaults_and_status_enum(db_session: Session) -> None:
    run = CatalogueSyncRun(source="dev_fixtures")
    db_session.add(run)
    db_session.flush()
    db_session.refresh(run)

    assert run.status is SyncRunStatus.RUNNING
    assert (run.created_count, run.updated_count, run.unchanged_count, run.error_count) == (
        0,
        0,
        0,
        0,
    )
    assert run.started_at is not None
    assert run.finished_at is None

    stored = db_session.execute(
        text("SELECT status::text FROM catalogue_sync_runs WHERE id = :id"), {"id": run.id}
    ).scalar_one()
    assert stored == "running"


def test_sync_run_rejects_unknown_status(db_session: Session) -> None:
    with pytest.raises(DataError, match="sync_run_status"):
        db_session.execute(
            text("INSERT INTO catalogue_sync_runs (source, status) VALUES ('x', 'bogus')")
        )


def test_lookup_indexes_exist(migrated_engine: Engine) -> None:
    inspector = inspect(migrated_engine)
    product_indexes = {i["name"] for i in inspector.get_indexes("products")}
    assert {"ix_products_sku", "ix_products_name_lower"} <= product_indexes
    product_uniques = {u["name"] for u in inspector.get_unique_constraints("products")}
    assert {"uq_products_slug", "uq_products_source_id"} <= product_uniques
    membership = {i["name"] for i in inspector.get_indexes("product_categories")}
    assert "ix_product_categories_category_id" in membership
