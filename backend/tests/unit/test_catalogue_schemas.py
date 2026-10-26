"""Validation of catalogue records before they reach the repositories (OR-012)."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from backend.app.schemas.catalogue import CategoryRecord, ImageRecord, ProductRecord

URL = "https://example.test/products/p1"


def test_missing_source_id_is_rejected() -> None:
    with pytest.raises(ValidationError, match="source_id"):
        ProductRecord.model_validate({"name": "Fixture", "source_url": URL})


@pytest.mark.parametrize("source_id", ["", "   "])
def test_blank_source_id_is_rejected(source_id: str) -> None:
    with pytest.raises(ValidationError, match="source_id"):
        ProductRecord(source_id=source_id, name="Fixture", source_url=URL)


@pytest.mark.parametrize("price", [Decimal("0"), Decimal("-5"), Decimal("1.234")])
def test_invalid_prices_are_rejected(price: Decimal) -> None:
    with pytest.raises(ValidationError, match="price_pkr"):
        ProductRecord(source_id="p1", name="Fixture", source_url=URL, price_pkr=price)


def test_absent_price_stays_none() -> None:
    assert ProductRecord(source_id="p1", name="Fixture", source_url=URL).price_pkr is None


@pytest.mark.parametrize("url", ["ftp://example.test/x", "not a url", "javascript:alert(1)"])
def test_non_http_source_urls_are_rejected(url: str) -> None:
    with pytest.raises(ValidationError, match="source_url"):
        ProductRecord(source_id="p1", name="Fixture", source_url=url)


def test_unknown_fields_are_rejected() -> None:
    with pytest.raises(ValidationError, match="rating"):
        ProductRecord.model_validate(
            {"source_id": "p1", "name": "Fixture", "source_url": URL, "rating": 5}
        )


def test_whitespace_is_stripped_and_category_ids_deduplicated() -> None:
    record = ProductRecord(
        source_id=" p1 ", name=" Fixture ", source_url=URL, category_source_ids=["c1", "c2", "c1"]
    )
    assert (record.source_id, record.name) == ("p1", "Fixture")
    assert record.category_source_ids == ["c1", "c2"]


def test_duplicate_image_urls_keep_the_first() -> None:
    first = ImageRecord(url="https://example.test/a.jpg", alt_text="First", source_url=URL)
    again = ImageRecord(url="https://example.test/a.jpg", alt_text="Again", source_url=URL)
    other = ImageRecord(url="https://example.test/b.jpg", alt_text="Other", source_url=URL)
    record = ProductRecord(
        source_id="p1", name="Fixture", source_url=URL, images=(first, again, other)
    )
    assert record.unique_images() == [first, other]


def test_category_record_parent_is_optional() -> None:
    assert CategoryRecord(source_id="c1", name="Skincare").parent_source_id is None
