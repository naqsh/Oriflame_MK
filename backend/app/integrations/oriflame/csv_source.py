"""Owner-maintained CSV catalogue (ADR-001 route: the owner's own list, not copied pages).

The owner fills in a spreadsheet (docs/templates/catalogue-template.csv) or maps a
back-office export to its columns, and saves it as CSV. Each row is one product:

    product_code, name, product_url            required
    price_pkr, category, description,          optional
    image_url, image_alt

The whole file is read and its structure checked before anything is yielded: a missing
or unreadable file, an unknown or missing column, or a file over the limits fails the
run with nothing changed. A bad row only skips that row; it is reported with its row
number, and because its product code is kept on the InvalidRecord, an existing product
keeps its last good version instead of being unlisted. Messages never echo cell values.
"""

import csv
import io
import re
from collections.abc import Iterator
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from pydantic import ValidationError

from backend.app.core.config import ALLOWED_REFERRAL_HOSTS
from backend.app.integrations.oriflame.client import (
    InvalidRecord,
    SourceCategory,
    SourceError,
    SourceMalformedError,
    SourceProduct,
    describe_validation_error,
)

CSV_SOURCE_NAME = "owner_csv"
CATEGORY_ID_PREFIX = "csv-cat-"
REQUIRED_COLUMNS = ("product_code", "name", "product_url")
OPTIONAL_COLUMNS = ("price_pkr", "category", "description", "image_url", "image_alt")
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000
CATEGORY_SEPARATOR = ">"
# Product links must point at Oriflame's official Pakistan site, like referral links.
OFFICIAL_PRODUCT_HOSTS = ALLOWED_REFERRAL_HOSTS
_OFFICIAL_HOSTS_TEXT = " or ".join(sorted(OFFICIAL_PRODUCT_HOSTS))

_CODE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$")
_PRICE_NOISE = re.compile(r"^(?:rs\.?|pkr)\s*", re.I)


class CsvCatalogueSource:
    """Reads one owner CSV file. Header names are case-insensitive."""

    def __init__(self, path: Path) -> None:
        rows = _read_rows(path)
        self._categories: dict[str, SourceCategory] = {}
        self._products: list[SourceProduct | InvalidRecord] = []
        first_row: dict[str, int] = {}
        for number, row in rows:
            self._products.append(self._product(number, row, first_row))

    @property
    def name(self) -> str:
        return CSV_SOURCE_NAME

    def iter_categories(self) -> Iterator[SourceCategory | InvalidRecord]:
        yield from self._categories.values()

    def iter_products(self) -> Iterator[SourceProduct | InvalidRecord]:
        yield from self._products

    def _product(
        self, number: int, row: dict[str, str], first_row: dict[str, int]
    ) -> SourceProduct | InvalidRecord:
        code = row.get("product_code", "")
        if not _CODE.match(code):
            return InvalidRecord(
                None,
                f"row {number}: product_code is missing or not a code "
                "(letters, digits, - or _, up to 40)",
            )
        if code in first_row:
            return InvalidRecord(
                code, f"row {number}: duplicate product_code (first used on row {first_row[code]})"
            )
        first_row[code] = number

        problems: list[str] = []
        url = row.get("product_url", "")
        if not _official_product_url(url):
            problems.append(f"product_url must be an https link on {_OFFICIAL_HOSTS_TEXT}")
        price, price_problem = _price(row.get("price_pkr", ""))
        if price_problem:
            problems.append(price_problem)
        if problems:
            return InvalidRecord(code, f"row {number}: {'; '.join(problems)}")

        payload: dict[str, Any] = {
            "source_id": code,
            "sku": code,
            "name": row.get("name", ""),
            "source_url": url,
            "description": row.get("description") or None,
            "price_pkr": price,
            "category_source_ids": self._category_ids(row.get("category", "")),
        }
        image_url = row.get("image_url", "")
        if image_url:
            payload["images"] = [
                {
                    "url": image_url,
                    "alt_text": row.get("image_alt") or row.get("name", ""),
                    "source_url": image_url,
                }
            ]
        try:
            return SourceProduct.model_validate(payload)
        except ValidationError as exc:
            return InvalidRecord(code, f"row {number}: {describe_validation_error(exc)}")

    def _category_ids(self, path: str) -> list[str]:
        """Register every level of "Parent > Child" and return the deepest level's id."""
        levels = [part.strip() for part in path.split(CATEGORY_SEPARATOR) if part.strip()]
        parent: str | None = None
        for depth in range(len(levels)):
            source_id = _category_id(levels[: depth + 1])
            if source_id not in self._categories:
                self._categories[source_id] = SourceCategory(
                    source_id=source_id, name=levels[depth][:200], parent_source_id=parent
                )
            parent = source_id
        return [parent] if parent else []


def _category_id(levels: list[str]) -> str:
    """Stable id from the category path, so renaming a parent does not orphan children."""
    slug = "-".join(re.sub(r"[^a-z0-9]+", "-", level.lower()).strip("-") for level in levels)
    return (CATEGORY_ID_PREFIX + (slug or "unnamed"))[:100]


def _official_product_url(url: str) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    return parts.scheme == "https" and (parts.hostname or "").lower() in OFFICIAL_PRODUCT_HOSTS


def _price(raw: str) -> tuple[Decimal | None, str | None]:
    """'1,499', 'Rs 1,499.50' and 'PKR 1499' are accepted; blank means no price."""
    text = _PRICE_NOISE.sub("", raw.strip()).replace(",", "").strip()
    if not text:
        return None, None
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None, "price_pkr is not a number"
    if not value.is_finite() or value <= 0:
        return None, "price_pkr must be more than 0 (leave it blank if unknown)"
    if value.as_tuple().exponent < -2:  # type: ignore[operator]
        return None, "price_pkr has more than 2 decimal places"
    return value, None


def _read_rows(path: Path) -> list[tuple[int, dict[str, str]]]:
    """(spreadsheet row number, cleaned row) for every non-blank data row."""
    try:
        size = path.stat().st_size
        if size > MAX_FILE_BYTES:
            raise SourceMalformedError(
                f"Catalogue file {path.name} is over {MAX_FILE_BYTES // (1024 * 1024)} MB"
            )
        raw = path.read_bytes()
    except FileNotFoundError:
        raise SourceError(f"Catalogue file not found: {path.name}") from None
    except OSError as exc:
        raise SourceError(
            f"Catalogue file {path.name} cannot be read ({type(exc).__name__})"
        ) from None
    try:
        text = raw.decode("utf-8-sig")  # Excel's "CSV UTF-8" adds a byte-order mark
    except UnicodeDecodeError:
        raise SourceMalformedError(
            f"Catalogue file {path.name} is not UTF-8; save it as 'CSV UTF-8'"
        ) from None

    reader = csv.reader(io.StringIO(text), delimiter=_delimiter(text))
    try:
        header = next(reader)
    except StopIteration:
        raise SourceMalformedError(f"Catalogue file {path.name} is empty") from None
    columns = [name.strip().lower() for name in header]
    _check_columns(path, columns)

    rows: list[tuple[int, dict[str, str]]] = []
    try:
        for number, cells in enumerate(reader, start=2):
            if not any(cell.strip() for cell in cells):
                continue
            if len(rows) >= MAX_ROWS:
                raise SourceMalformedError(
                    f"Catalogue file {path.name} has more than {MAX_ROWS} products"
                )
            row = {column: cell.strip() for column, cell in zip(columns, cells, strict=False)}
            rows.append((number, row))
    except csv.Error as exc:
        raise SourceMalformedError(f"Catalogue file {path.name} is not valid CSV: {exc}") from None
    return rows


def _delimiter(text: str) -> str:
    """Comma, semicolon (Excel in many locales) or tab, judged from the header line only.

    Column names never contain these characters, unlike cells (prices, links), so the
    header is a reliable sample; a comma wins ties.
    """
    header = text.split("\n", 1)[0]
    return max((",", ";", "\t"), key=header.count)


def _check_columns(path: Path, columns: list[str]) -> None:
    known = set(REQUIRED_COLUMNS) | set(OPTIONAL_COLUMNS)
    unknown = [column for column in columns if column and column not in known]
    if unknown:
        raise SourceMalformedError(
            f"Catalogue file {path.name} has unknown column(s): {', '.join(unknown)}. "
            f"Allowed: {', '.join((*REQUIRED_COLUMNS, *OPTIONAL_COLUMNS))}"
        )
    duplicated = sorted({column for column in columns if column and columns.count(column) > 1})
    if duplicated:
        raise SourceMalformedError(
            f"Catalogue file {path.name} repeats column(s): {', '.join(duplicated)}"
        )
    missing = [column for column in REQUIRED_COLUMNS if column not in columns]
    if missing:
        raise SourceMalformedError(
            f"Catalogue file {path.name} is missing required column(s): {', '.join(missing)}"
        )
