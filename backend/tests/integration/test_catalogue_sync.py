"""CatalogueSyncService against real PostgreSQL (OR-014).

The service commits, so these tests use their own sessions and empty the catalogue
tables before and after each test instead of the rolled-back db_session.
"""

import json
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, func, select, text, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session, sessionmaker
from structlog.testing import capture_logs

from backend.app.integrations.oriflame import catalogue as catalogue_module
from backend.app.integrations.oriflame.catalogue import (
    MAX_DETAIL_LINES,
    CatalogueSyncService,
    MixedSourcesError,
)
from backend.app.integrations.oriflame.client import (
    InvalidRecord,
    SourceAuthError,
    SourceCategory,
    SourcePageError,
    SourceProduct,
    SourceUnavailableError,
)
from backend.app.integrations.oriflame.fixtures import DEFAULT_FIXTURE_PATH, FixtureCatalogueSource
from backend.app.models import CatalogueSyncRun, Category, Product, ProductImage, SyncRunStatus
from backend.app.repositories.products import upsert_product
from backend.app.repositories.sync_runs import SyncAlreadyRunningError, catalogue_sync_lock

pytestmark = pytest.mark.db

TABLES = "product_images, product_categories, products, categories, catalogue_sync_runs"

CategoryItem = SourceCategory | InvalidRecord
ProductItem = SourceProduct | InvalidRecord | Exception


def _product(source_id: str, **overrides: Any) -> SourceProduct:
    fields: dict[str, Any] = {
        "source_id": source_id,
        "name": f"Sample Product {source_id}",
        "source_url": f"http://localhost:3000/dev-fixture/{source_id}",
        "category_source_ids": ["dev-cat-1"],
        "images": [
            {
                "url": f"http://localhost:3000/dev-fixture/{source_id}.svg",
                "alt_text": f"Placeholder for {source_id}",
                "source_url": f"http://localhost:3000/dev-fixture/{source_id}",
            }
        ],
    }
    fields.update(overrides)
    return SourceProduct.model_validate(fields)


CATEGORIES: list[CategoryItem] = [SourceCategory(source_id="dev-cat-1", name="Sample Category")]


@dataclass
class ListSource:
    """In-memory CatalogueSource. An Exception in ``products`` is raised at that point."""

    products: Sequence[ProductItem]
    categories: Sequence[CategoryItem] = tuple(CATEGORIES)
    name: str = "test_source"

    def iter_categories(self) -> Iterator[CategoryItem]:
        yield from self.categories

    def iter_products(self) -> Iterator[SourceProduct | InvalidRecord]:
        for item in self.products:
            if isinstance(item, Exception):
                raise item
            yield item


@pytest.fixture
def sessions(migrated_engine: Engine) -> Iterator[sessionmaker[Session]]:
    def empty() -> None:
        with migrated_engine.begin() as connection:
            connection.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))

    empty()
    yield sessionmaker(bind=migrated_engine, expire_on_commit=False)
    empty()


@pytest.fixture
def service(migrated_engine: Engine, sessions: sessionmaker[Session]) -> CatalogueSyncService:
    return CatalogueSyncService(migrated_engine, sessions, batch_size=2)


def _counts(sessions: sessionmaker[Session]) -> tuple[int, int, int]:
    with sessions() as session:
        return tuple(  # type: ignore[return-value]
            session.scalar(select(func.count()).select_from(model)) or 0
            for model in (Product, Category, ProductImage)
        )


def _visible(sessions: sessionmaker[Session]) -> dict[str, bool]:
    """On the storefront: the owner has not hidden it and the source still lists it."""
    with sessions() as session:
        rows = session.execute(
            select(Product.source_id, Product.is_visible & Product.listed_by_source)
        )
        return {source_id: visible for source_id, visible in rows}


def _flags(sessions: sessionmaker[Session], source_id: str) -> tuple[bool, bool, bool]:
    with sessions() as session:
        row = session.execute(
            select(Product.is_visible, Product.is_featured, Product.listed_by_source).where(
                Product.source_id == source_id
            )
        ).one()
        return (row.is_visible, row.is_featured, row.listed_by_source)


def _runs(sessions: sessionmaker[Session]) -> list[CatalogueSyncRun]:
    with sessions() as session:
        return list(session.scalars(select(CatalogueSyncRun).order_by(CatalogueSyncRun.id)))


def test_two_runs_of_the_same_fixture_are_idempotent(
    service: CatalogueSyncService, sessions: sessionmaker[Session], tmp_path: Path
) -> None:
    path = tmp_path / "dev_catalogue_sync.json"
    path.write_text(
        json.dumps(
            {
                "fixture_notice": "Development fixture - sync test",
                "categories": [{"source_id": "dev-cat-1", "name": "Sample Category"}],
                "products": [_product(f"dev-{n}").model_dump(mode="json") for n in range(5)],
            }
        ),
        encoding="utf-8",
    )

    first = service.run(FixtureCatalogueSource(path, app_env="test"))
    after_first = _counts(sessions)
    second = service.run(FixtureCatalogueSource(path, app_env="test"))

    assert after_first == _counts(sessions) == (5, 1, 5)
    assert first.status is second.status is SyncRunStatus.SUCCESS
    assert (first.counts.created, second.counts.created) == (5, 0)
    assert (second.counts.updated, second.counts.unchanged, second.counts.errors) == (0, 5, 0)
    runs = _runs(sessions)
    assert [r.source for r in runs] == ["dev_fixture", "dev_fixture"]
    assert all(r.finished_at is not None for r in runs)


def test_invalid_record_is_counted_and_the_run_is_partial(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    source = ListSource([_product("p1"), InvalidRecord("p2", "name: Field required")])

    report = service.run(source)

    assert report.status is SyncRunStatus.PARTIAL
    assert (report.counts.created, report.counts.errors) == (1, 1)
    assert report.error_detail == "product p2: name: Field required"
    assert _counts(sessions)[0] == 1


def test_invalid_category_is_counted(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    source = ListSource(
        [_product("p1")], categories=[*CATEGORIES, InvalidRecord(None, "source_id: missing")]
    )
    report = service.run(source)
    assert report.status is SyncRunStatus.PARTIAL
    assert report.error_detail is not None
    assert "category (no source_id): source_id: missing" in report.error_detail


def test_record_the_database_rejects_is_skipped(
    service: CatalogueSyncService,
    sessions: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def flaky(session: Session, record: SourceProduct, **kwargs: Any) -> Any:
        if record.source_id == "p2":
            raise IntegrityError("INSERT ...", {}, Exception("driver detail with secrets"))
        return upsert_product(session, record, **kwargs)

    monkeypatch.setattr(catalogue_module, "upsert_product", flaky)
    report = service.run(ListSource([_product("p1"), _product("p2"), _product("p3")]))

    assert report.status is SyncRunStatus.PARTIAL
    assert report.counts.created == 2
    assert report.error_detail == "product p2: database rejected it (IntegrityError)"
    assert set(_visible(sessions)) == {"p1", "p3"}


def test_mid_run_failure_is_recorded_and_a_rerun_completes_without_duplicates(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    products = [_product(f"p{n}") for n in range(1, 6)]
    broken = ListSource([*products[:3], SourceUnavailableError("GET /products timed out")])

    failed = service.run(broken)

    assert failed.status is SyncRunStatus.FAILED
    assert failed.error_detail == "Source failed: GET /products timed out"
    assert _counts(sessions)[0] == 2  # the committed batch stays; the open one rolled back

    rerun = service.run(ListSource(products))

    assert rerun.status is SyncRunStatus.SUCCESS
    assert (rerun.counts.created, rerun.counts.unchanged) == (3, 2)
    assert _counts(sessions) == (5, 1, 5)


def test_failure_on_a_later_page_is_partial_and_hides_nothing(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    service.run(ListSource([_product("p1"), _product("p2")]))
    page_error = SourcePageError(2, SourceUnavailableError("GET /products returned 503"))

    report = service.run(ListSource([_product("p1"), page_error]))

    assert report.status is SyncRunStatus.PARTIAL
    assert report.hidden_source_ids == []
    assert _visible(sessions) == {"p1": True, "p2": True}
    assert report.error_detail is not None
    assert "Page 2 failed" in report.error_detail


def test_auth_failure_fails_the_run_and_writes_nothing(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    @dataclass
    class RefusingSource(ListSource):
        def iter_categories(self) -> Iterator[CategoryItem]:
            raise SourceAuthError("GET /categories was refused with 403; not retrying")

    report = service.run(RefusingSource([_product("p1")]))

    assert report.status is SyncRunStatus.FAILED
    assert report.error_detail is not None
    assert "403" in report.error_detail
    assert _counts(sessions) == (0, 0, 0)


@pytest.mark.parametrize(
    "products",
    [[], [InvalidRecord("p1", "name: Field required")]],
    ids=["empty", "all-invalid"],
)
def test_no_valid_products_fails_instead_of_hiding_the_catalogue(
    service: CatalogueSyncService, sessions: sessionmaker[Session], products: list[ProductItem]
) -> None:
    service.run(ListSource([_product("p1")]))

    report = service.run(ListSource(products))

    assert report.status is SyncRunStatus.FAILED
    assert report.error_detail is not None
    assert "refusing to hide the catalogue" in report.error_detail
    assert _visible(sessions) == {"p1": True}


def test_products_removed_from_the_source_are_hidden_not_deleted(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    service.run(ListSource([_product("p1"), _product("p2"), _product("p3")]))

    report = service.run(ListSource([_product("p1")]))

    assert report.status is SyncRunStatus.SUCCESS
    assert report.hidden_source_ids == ["p2", "p3"]
    assert _visible(sessions) == {"p1": True, "p2": False, "p3": False}
    assert report.error_detail == "Hidden (no longer listed by the source): 2"


def test_unknown_references_are_noted_without_failing(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    source = ListSource(
        [_product("p1", category_source_ids=["dev-cat-1", "ghost"])],
        categories=[SourceCategory(source_id="dev-cat-1", name="Sample", parent_source_id="gone")],
    )
    report = service.run(source)

    assert report.status is SyncRunStatus.SUCCESS
    assert report.counts.errors == 0
    assert report.error_detail == (
        "category dev-cat-1: unknown parent gone\nproduct p1: unknown categories ghost"
    )


def test_concurrent_run_is_refused_without_creating_a_run(
    service: CatalogueSyncService, sessions: sessionmaker[Session], migrated_engine: Engine
) -> None:
    with (
        catalogue_sync_lock(migrated_engine),
        pytest.raises(SyncAlreadyRunningError, match="already running"),
    ):
        service.run(ListSource([_product("p1")]))
    assert _runs(sessions) == []


def test_orphaned_running_run_is_marked_failed_at_next_start(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    with sessions.begin() as session:
        session.add(CatalogueSyncRun(source="crashed", status=SyncRunStatus.RUNNING))

    service.run(ListSource([_product("p1")]))

    orphan, current = _runs(sessions)
    assert orphan.status is SyncRunStatus.FAILED
    assert orphan.error_detail is not None
    assert "stale run recovery" in orphan.error_detail
    assert current.status is SyncRunStatus.SUCCESS


def test_error_detail_lists_a_bounded_number_of_lines(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    invalid = [InvalidRecord(f"bad-{n}", "name: Field required") for n in range(60)]
    report = service.run(ListSource([_product("p1"), *invalid]))

    assert report.counts.errors == 60
    assert report.error_detail is not None
    lines = report.error_detail.splitlines()
    assert len(lines) == MAX_DETAIL_LINES + 1
    assert lines[-1] == "... and 10 more"


def test_database_failure_outside_a_record_is_recorded_then_raised(
    service: CatalogueSyncService,
    sessions: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def broken(*_: object) -> list[str]:
        raise OperationalError("UPDATE products ...", {}, Exception("server closed connection"))

    monkeypatch.setattr(catalogue_module, "hide_products_missing_from", broken)
    with pytest.raises(OperationalError):
        service.run(ListSource([_product("p1")]))

    [run] = _runs(sessions)
    assert run.status is SyncRunStatus.FAILED
    assert run.error_detail == "Database error (OperationalError); see server logs"


def test_sync_emits_structured_events(service: CatalogueSyncService) -> None:
    with capture_logs() as logs:
        service.run(ListSource([_product("p1")]))
        service.run(ListSource([]))

    events = [entry["event"] for entry in logs]
    assert events == [
        "catalogue_sync_started",
        "catalogue_sync_finished",
        "catalogue_sync_started",
        "catalogue_sync_failed",
    ]
    finished = logs[1]
    assert (finished["status"], finished["created"], finished["source"]) == (
        "success",
        1,
        "test_source",
    )


def test_hidden_product_that_reappears_is_updated_but_stays_hidden(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    """Owner flags (OR-048) survive a sync, even one that changes the product's facts."""
    service.run(ListSource([_product("p1"), _product("p2")]))
    with sessions.begin() as session:
        session.execute(update(Product).where(Product.source_id == "p2").values(is_visible=False))
        session.execute(update(Product).where(Product.source_id == "p1").values(is_featured=True))

    service.run(ListSource([_product("p1"), _product("p2", name="Renamed")]))

    assert _visible(sessions) == {"p1": True, "p2": False}
    assert _flags(sessions, "p1") == (True, True, True)
    assert _flags(sessions, "p2") == (False, False, True)


def test_unlisting_keeps_owner_flags_and_relisting_restores_the_product(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    service.run(ListSource([_product("p1"), _product("p2")]))
    with sessions.begin() as session:
        session.execute(update(Product).where(Product.source_id == "p2").values(is_featured=True))

    service.run(ListSource([_product("p1")]))
    assert _flags(sessions, "p2") == (True, True, False)
    assert _visible(sessions) == {"p1": True, "p2": False}

    # Back in the source, unchanged facts: listed again, counted as an update.
    report = service.run(ListSource([_product("p1"), _product("p2")]))
    assert _flags(sessions, "p2") == (True, True, True)
    assert _visible(sessions) == {"p1": True, "p2": True}
    assert (report.counts.created, report.counts.updated, report.counts.unchanged) == (0, 1, 1)


# --- Development fixtures and mixed sources (OR-015) ---------------------------------


def test_shipped_sample_fixture_syncs_idempotently_and_is_marked(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    first = service.run(FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env="development"))
    second = service.run(FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env="development"))

    assert first.status is second.status is SyncRunStatus.SUCCESS
    assert first.error_detail is None
    assert (first.counts.created, second.counts.unchanged) == (12, 12)
    assert _counts(sessions) == (12, 3, 9)
    with sessions() as session:
        assert set(session.scalars(select(Product.source))) == {"dev_fixture"}


def test_fixture_sync_refused_when_real_products_exist(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    service.run(ListSource([_product("real-1")], name="permitted_feed"))

    with pytest.raises(MixedSourcesError, match="permitted_feed"):
        service.run(FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env="development"))

    assert len(_runs(sessions)) == 1  # the refused sync recorded nothing
    assert set(_visible(sessions)) == {"real-1"}


def test_real_sync_refused_when_fixture_products_exist(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    service.run(FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env="development"))
    with pytest.raises(MixedSourcesError, match="dev_fixture"):
        service.run(ListSource([_product("real-1")], name="permitted_feed"))


def test_forced_mixing_never_hides_the_other_sources_products(
    service: CatalogueSyncService, sessions: sessionmaker[Session]
) -> None:
    service.run(ListSource([_product("real-1")], name="permitted_feed"))

    report = service.run(
        FixtureCatalogueSource(DEFAULT_FIXTURE_PATH, app_env="development"),
        allow_mixed_sources=True,
    )

    assert report.status is SyncRunStatus.SUCCESS
    assert report.hidden_source_ids == []
    assert _visible(sessions)["real-1"] is True
