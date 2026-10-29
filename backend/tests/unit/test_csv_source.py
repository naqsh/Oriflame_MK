"""Owner CSV catalogue source: file checks, row validation, categories (OR-E11)."""

import ast
from decimal import Decimal
from pathlib import Path

import pytest

import backend.app.integrations.oriflame as integration
from backend.app.core.config import ConfigurationError, load_settings
from backend.app.integrations.oriflame import get_catalogue_source, resolve_csv_path
from backend.app.integrations.oriflame.client import (
    InvalidRecord,
    SourceCategory,
    SourceError,
    SourceMalformedError,
    SourceProduct,
)
from backend.app.integrations.oriflame.csv_source import (
    CSV_SOURCE_NAME,
    MAX_ROWS,
    CsvCatalogueSource,
)

HEADER = "product_code,name,product_url,price_pkr,category,description,image_url,image_alt"
BASIC = "product_code,name,product_url"
REPO_ROOT = Path(integration.__file__).parents[4]
TEMPLATE = REPO_ROOT / "docs" / "templates" / "catalogue-template.csv"


def url(code: str) -> str:
    return f"https://pk.oriflame.com/products/product?code={code}"


def write(tmp_path: Path, *lines: str, name: str = "catalogue.csv", bom: bool = False) -> Path:
    path = tmp_path / name
    path.write_text("\n".join(lines) + "\n", encoding="utf-8-sig" if bom else "utf-8")
    return path


def products(source: CsvCatalogueSource) -> list[SourceProduct | InvalidRecord]:
    return list(source.iter_products())


def only_valid(source: CsvCatalogueSource) -> list[SourceProduct]:
    return [item for item in products(source) if isinstance(item, SourceProduct)]


def categories(source: CsvCatalogueSource) -> dict[str, tuple[str, str | None]]:
    return {
        item.source_id: (item.name, item.parent_source_id)
        for item in source.iter_categories()
        if isinstance(item, SourceCategory)
    }


# --- Valid files -------------------------------------------------------------------------


def test_reads_products_with_optional_columns(tmp_path: Path) -> None:
    path = write(
        tmp_path,
        HEADER,
        f'T001,Test Cream,{url("T001")},"1,499",Skincare > Face Care,My own words,'
        "https://images.example.pk/t001.jpg,Jar of test cream",
        f"T002,Test Lipstick,{url('T002')},,,,,",
    )
    source = CsvCatalogueSource(path)

    assert source.name == CSV_SOURCE_NAME
    cream, lipstick = only_valid(source)
    assert (cream.source_id, cream.sku) == ("T001", "T001")
    assert cream.price_pkr == Decimal("1499")
    assert cream.description == "My own words"
    assert cream.category_source_ids == ["csv-cat-skincare-face-care"]
    assert [(image.url, image.alt_text) for image in cream.images] == [
        ("https://images.example.pk/t001.jpg", "Jar of test cream")
    ]
    assert lipstick.price_pkr is None
    assert lipstick.description is None
    assert lipstick.images == ()
    assert lipstick.category_source_ids == []


def test_builds_the_category_tree_once_per_path(tmp_path: Path) -> None:
    path = write(
        tmp_path,
        f"{BASIC},category",
        f"T001,One,{url('T001')},Skincare > Face Care",
        f"T002,Two,{url('T002')},Skincare > Body",
        f"T003,Three,{url('T003')},  skincare  >  face care ",
        f"T004,Four,{url('T004')},Make-up",
    )
    assert categories(CsvCatalogueSource(path)) == {
        "csv-cat-skincare": ("Skincare", None),
        "csv-cat-skincare-face-care": ("Face Care", "csv-cat-skincare"),
        "csv-cat-skincare-body": ("Body", "csv-cat-skincare"),
        "csv-cat-make-up": ("Make-up", None),
    }


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1499", "1499"),
        ("1,499.50", "1499.50"),
        ("Rs 1,499", "1499"),
        ("Rs.999", "999"),
        ("PKR 250", "250"),
    ],
)
def test_accepts_common_price_formats(tmp_path: Path, raw: str, expected: str) -> None:
    path = write(tmp_path, f"{BASIC},price_pkr", f'T001,One,{url("T001")},"{raw}"')
    [product] = only_valid(CsvCatalogueSource(path))
    assert product.price_pkr == Decimal(expected)


def test_excel_utf8_semicolons_header_case_and_blank_rows(tmp_path: Path) -> None:
    path = write(
        tmp_path,
        "Product_Code;NAME;Product_URL",
        "",
        f"T001;Gulab cream گلاب;{url('T001')}",
        ";;",
        bom=True,
    )
    [product] = only_valid(CsvCatalogueSource(path))
    assert product.name == "Gulab cream گلاب"


def test_tab_separated_files_work(tmp_path: Path) -> None:
    path = write(tmp_path, BASIC.replace(",", "\t"), f"T001\tOne\t{url('T001')}")
    [product] = only_valid(CsvCatalogueSource(path))
    assert product.source_id == "T001"


def test_the_shipped_template_has_every_column_and_no_products() -> None:
    assert products(CsvCatalogueSource(TEMPLATE)) == []


# --- Bad rows: skipped, reported by row number, never echoing values -----------------------


def test_bad_rows_are_reported_by_row_and_keep_their_code(tmp_path: Path) -> None:
    path = write(
        tmp_path,
        f"{BASIC},price_pkr",
        f"T001,Good,{url('T001')},100",
        "T002,Wrong host,https://shop.example.com/p/T002,100",
        f"T003,Free,{url('T003')},0",
        f"T004,Text price,{url('T004')},about 500",
        f"T005,Too precise,{url('T005')},1.505",
        f"T006,,{url('T006')},100",
        f"bad code!,Bad code,{url('X')},100",
        f"T001,Duplicate,{url('T001')},100",
        "T009,Plain http,http://pk.oriflame.com/p,100",
    )
    items = products(CsvCatalogueSource(path))
    bad = {item.problems.split(":")[0]: item for item in items if isinstance(item, InvalidRecord)}

    assert [item.source_id for item in items if isinstance(item, SourceProduct)] == ["T001"]
    assert bad["row 3"].source_id == "T002"
    assert "pk.oriflame.com" in bad["row 3"].problems
    assert "more than 0" in bad["row 4"].problems
    assert "not a number" in bad["row 5"].problems
    assert "2 decimal places" in bad["row 6"].problems
    assert bad["row 7"].source_id == "T006"
    assert "name" in bad["row 7"].problems
    assert bad["row 8"].source_id is None
    assert bad["row 9"].source_id == "T001"
    assert "first used on row 2" in bad["row 9"].problems
    assert bad["row 10"].source_id == "T009"
    for item in bad.values():
        for value in ("shop.example.com", "about 500", "bad code!", "Wrong host"):
            assert value not in item.problems


# --- Whole-file problems: nothing loads ----------------------------------------------------


def test_unknown_columns_fail_the_file_and_list_the_allowed_ones(tmp_path: Path) -> None:
    path = write(tmp_path, f"{BASIC},prise", f"T001,One,{url('T001')},100")
    pattern = r"unknown column\(s\): prise\. Allowed: product_code"
    with pytest.raises(SourceMalformedError, match=pattern):
        CsvCatalogueSource(path)


@pytest.mark.parametrize(
    ("header", "message"),
    [("product_code,name", "missing required column"), (f"{BASIC},name", "repeats column")],
)
def test_missing_or_repeated_columns_fail(tmp_path: Path, header: str, message: str) -> None:
    with pytest.raises(SourceMalformedError, match=message):
        CsvCatalogueSource(write(tmp_path, header))


def test_empty_missing_and_non_utf8_files_fail_cleanly(tmp_path: Path) -> None:
    empty = tmp_path / "empty.csv"
    empty.write_text("", encoding="utf-8")
    with pytest.raises(SourceMalformedError, match="is empty"):
        CsvCatalogueSource(empty)
    with pytest.raises(SourceError, match=r"not found: nothing\.csv"):
        CsvCatalogueSource(tmp_path / "nothing.csv")
    latin = tmp_path / "latin.csv"
    latin.write_bytes(f"{BASIC}\nT1,Cr\xe8me,x\n".encode("latin-1"))
    with pytest.raises(SourceMalformedError, match="save it as 'CSV UTF-8'"):
        CsvCatalogueSource(latin)


def test_row_and_size_limits(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    rows = [f"T{n},Product {n},{url(f'T{n}')}" for n in range(MAX_ROWS + 1)]
    with pytest.raises(SourceMalformedError, match=f"more than {MAX_ROWS} products"):
        CsvCatalogueSource(write(tmp_path, BASIC, *rows))

    monkeypatch.setattr("backend.app.integrations.oriflame.csv_source.MAX_FILE_BYTES", 10)
    with pytest.raises(SourceMalformedError, match="is over"):
        CsvCatalogueSource(write(tmp_path, BASIC, name="big.csv"))


# --- Configuration and selection -----------------------------------------------------------


def test_csv_source_requires_a_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATALOGUE_SOURCE", "csv")
    monkeypatch.setenv("CATALOGUE_CSV_PATH", "  ")
    with pytest.raises(ConfigurationError, match="CATALOGUE_CSV_PATH"):
        load_settings()


def test_get_catalogue_source_reads_the_configured_csv(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = write(tmp_path, BASIC, f"T001,One,{url('T001')}")
    monkeypatch.setenv("CATALOGUE_SOURCE", "csv")
    monkeypatch.setenv("CATALOGUE_CSV_PATH", str(path))
    source = get_catalogue_source(load_settings())
    assert source.name == CSV_SOURCE_NAME
    assert [item.source_id for item in source.iter_products()] == ["T001"]


def test_relative_paths_are_from_the_repository_root(tmp_path: Path) -> None:
    assert resolve_csv_path(Path("data/catalogue.csv")) == REPO_ROOT / "data" / "catalogue.csv"
    absolute = tmp_path / "catalogue.csv"
    assert resolve_csv_path(absolute) == absolute


def test_the_csv_source_makes_no_network_requests() -> None:
    """ADR-001: the owner's file is the source; nothing is fetched from Oriflame or anyone."""
    module = Path(integration.__file__).parent / "csv_source.py"
    tree = ast.parse(module.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert imported.isdisjoint({"httpx", "requests", "urllib3", "aiohttp", "http", "socket"})
