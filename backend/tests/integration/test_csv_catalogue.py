"""Owner CSV catalogue end to end on PostgreSQL: CLI sync, bad rows, swapping fixtures."""

import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine, select, text
from sqlalchemy.orm import Session

from backend.app.cli import EXIT_MIXED_SOURCES, EXIT_OK, EXIT_USAGE, main
from backend.app.models import Category, Product

pytestmark = pytest.mark.db

TABLES = "product_images, product_categories, products, categories, catalogue_sync_runs"
BASIC = "product_code,name,product_url,price_pkr,category"


def url(code: str) -> str:
    return f"https://pk.oriflame.com/products/product?code={code}"


def _run(*argv: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    code = main(list(argv), out=out, err=err)
    return code, out.getvalue(), err.getvalue()


@pytest.fixture
def csv_file(
    tmp_path: Path,
    migrated_engine: Engine,
    test_database_url: str,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Path]:
    def empty() -> None:
        with migrated_engine.begin() as connection:
            connection.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))

    path = tmp_path / "catalogue.csv"
    monkeypatch.setenv("POSTGRES_URL", test_database_url)
    monkeypatch.setenv("CATALOGUE_SOURCE", "csv")
    monkeypatch.setenv("CATALOGUE_CSV_PATH", str(path))
    empty()
    yield path
    empty()


def write(path: Path, *rows: str) -> None:
    path.write_text("\n".join([BASIC, *rows]) + "\n", encoding="utf-8")


def product(engine: Engine, code: str) -> Product:
    with Session(engine) as session:
        return session.scalars(select(Product).where(Product.source_id == code)).one()


def test_sync_imports_the_owners_list_with_categories(
    csv_file: Path, migrated_engine: Engine
) -> None:
    write(
        csv_file,
        f'T001,Test Cream,{url("T001")},"1,499",Skincare > Face Care',
        f"T002,Test Lipstick,{url('T002')},,Make-up",
    )

    code, out, err = _run("sync")

    assert code == EXIT_OK, err
    assert "success" in out
    assert "created=2" in out
    cream = product(migrated_engine, "T001")
    assert (cream.source, cream.sku, str(cream.price_pkr)) == ("owner_csv", "T001", "1499.00")
    assert cream.source_url == url("T001")
    with Session(migrated_engine) as session:
        names = sorted(session.scalars(select(Category.name)))
    assert names == ["Face Care", "Make-up", "Skincare"]


def test_a_typo_keeps_the_product_visible_and_marks_the_run_partial(
    csv_file: Path, migrated_engine: Engine
) -> None:
    write(
        csv_file,
        f"T001,Cream,{url('T001')},100,",
        f"T002,Balm,{url('T002')},200,",
        f"T003,Oil,{url('T003')},300,",
    )
    assert _run("sync")[0] == EXIT_OK

    # The owner mistypes T002's price (letter O for zero) and removes T001 from the list.
    write(csv_file, f"T002,Balm,{url('T002')},2OO,", f"T003,Oil,{url('T003')},300,")
    code, out, _ = _run("sync")

    assert code == EXIT_OK
    assert "partial" in out
    assert "row 2: price_pkr is not a number" in out
    balm = product(migrated_engine, "T002")
    assert (balm.listed_by_source, str(balm.price_pkr)) == (True, "200.00")  # last good version
    assert product(migrated_engine, "T001").listed_by_source is False  # really gone from the list
    assert product(migrated_engine, "T003").listed_by_source is True


def test_a_file_with_no_valid_rows_fails_and_changes_nothing(
    csv_file: Path, migrated_engine: Engine
) -> None:
    write(csv_file, f"T001,Cream,{url('T001')},100,")
    assert _run("sync")[0] == EXIT_OK

    write(csv_file, f"T002,Balm,{url('T002')},2OO,")
    code, out, _ = _run("sync")

    assert code != EXIT_OK
    assert "failed" in out
    assert product(migrated_engine, "T001").listed_by_source is True


def test_a_broken_file_changes_nothing(csv_file: Path, migrated_engine: Engine) -> None:
    write(csv_file, f"T001,Cream,{url('T001')},100,")
    assert _run("sync")[0] == EXIT_OK

    csv_file.write_text("product_code,name,product_link\nT001,Cream,x\n", encoding="utf-8")
    code, out, err = _run("sync")

    assert code != EXIT_OK
    assert "unknown column(s): product_link" in out + err
    assert product(migrated_engine, "T001").listed_by_source is True


def test_swapping_fixtures_for_the_csv(csv_file: Path, migrated_engine: Engine) -> None:
    assert _run("sync", "--fixtures")[0] == EXIT_OK
    write(csv_file, f"T001,Cream,{url('T001')},100,Skincare")

    code, _, err = _run("sync")
    assert code == EXIT_MIXED_SOURCES
    assert "dev_fixture" in err

    code, _, err = _run("remove-fixtures")
    assert code == EXIT_USAGE
    assert "--yes" in err

    code, out, err = _run("remove-fixtures", "--yes")
    assert code == EXIT_OK, err
    assert "Removed 12 fixture product(s) and 3 fixture categor(ies)" in out

    code, out, err = _run("sync")
    assert code == EXIT_OK, err
    with Session(migrated_engine) as session:
        assert list(session.scalars(select(Product.source).distinct())) == ["owner_csv"]
        assert list(session.scalars(select(Category.source_id))) == ["csv-cat-skincare"]


def test_remove_fixtures_never_touches_other_sources(
    csv_file: Path, migrated_engine: Engine
) -> None:
    write(csv_file, f"T001,Cream,{url('T001')},100,Skincare")
    assert _run("sync")[0] == EXIT_OK

    code, out, _ = _run("remove-fixtures", "--yes")

    assert code == EXIT_OK
    assert "Removed 0 fixture product(s) and 0 fixture categor(ies)" in out
    assert product(migrated_engine, "T001").source == "owner_csv"
