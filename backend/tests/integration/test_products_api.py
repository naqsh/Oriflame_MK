"""GET /api/v1/products and /api/v1/products/{slug} against real PostgreSQL (OR-018)."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.models import Category, Product, ProductImage
from backend.app.services import products as service_module

pytestmark = pytest.mark.db

SYNCED = datetime(2026, 10, 26, tzinfo=UTC)
BASE_TIME = datetime(2026, 1, 1, tzinfo=UTC)


@pytest.fixture
def api(db_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


def _product(
    session: Session,
    n: int,
    name: str,
    *,
    price: str | None = None,
    visible: bool = True,
    categories: list[Category] | None = None,
    images: int = 1,
    source: str = "dev_fixture",
) -> Product:
    product = Product(
        source_id=f"src-{n}",
        source=source,
        slug=name.lower().replace(" ", "-"),
        name=name,
        sku=f"DEV-{n:04d}",
        description=f"Description of {name}",
        price_pkr=Decimal(price) if price else None,
        source_url=f"http://localhost:3000/dev-fixture/products/src-{n}",
        last_synced_at=SYNCED,
        is_visible=visible,
        created_at=BASE_TIME + timedelta(days=n),
        categories=categories or [],
    )
    for position in range(images):
        product.images.append(
            ProductImage(
                url=f"http://localhost:3000/dev-fixture/{n}-{position}.svg",
                alt_text=f"{name} image {position}",
                position=position,
                source_url=product.source_url,
            )
        )
    session.add(product)
    return product


@pytest.fixture
def catalogue(db_session: Session) -> dict[str, Any]:
    face = Category(source_id="c-face", slug="face", name="Face")
    cream = Category(source_id="c-cream", slug="face-cream", name="Face Cream", parent=face)
    body = Category(source_id="c-body", slug="body", name="Body")
    db_session.add_all([face, cream, body])
    _product(db_session, 1, "Apricot Scrub", price="1500.00", categories=[face])
    _product(db_session, 2, "Birch Cream", price="999.50", categories=[cream])
    _product(db_session, 3, "Cedar Lotion", price=None, categories=[body], images=0)
    _product(db_session, 4, "Daisy Balm", price="2500.00", categories=[face, body], images=2)
    _product(db_session, 5, "Elm Hidden", price="10.00", categories=[face], visible=False)
    _product(db_session, 6, "Fern Toner", price=None, categories=[cream], source="feed")
    db_session.flush()
    return {"face": face, "cream": cream, "body": body}


def _names(response: Any) -> list[str]:
    return [item["name"] for item in response.json()["items"]]


# --- Listing ------------------------------------------------------------------------


def test_list_returns_visible_products_with_page_metadata(
    api: TestClient, catalogue: dict[str, Any]
) -> None:
    response = api.get("/api/v1/products")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert (body["total"], body["page"], body["page_size"]) == (5, 1, 24)
    assert _names(response) == [
        "Apricot Scrub",
        "Birch Cream",
        "Cedar Lotion",
        "Daisy Balm",
        "Fern Toner",
    ]
    first = body["items"][0]
    assert first == {
        "slug": "apricot-scrub",
        "name": "Apricot Scrub",
        "price_pkr": "1500.00",
        "currency": "PKR",
        "primary_image": {
            "url": "http://localhost:3000/dev-fixture/1-0.svg",
            "alt_text": "Apricot Scrub image 0",
        },
        "availability": {
            "status": "not_confirmed",
            "label": "Availability not confirmed",
            "checked_at": None,
        },
        "data_source": "dev_fixture",
        "is_development_data": True,
    }
    by_name = {item["name"]: item for item in body["items"]}
    assert by_name["Cedar Lotion"]["price_pkr"] is None
    assert by_name["Cedar Lotion"]["primary_image"] is None
    assert by_name["Fern Toner"]["is_development_data"] is False


def test_pagination_totals_and_pages(api: TestClient, catalogue: dict[str, Any]) -> None:
    page_two = api.get("/api/v1/products", params={"page_size": 2, "page": 2})
    assert page_two.json()["total"] == 5
    assert _names(page_two) == ["Cedar Lotion", "Daisy Balm"]

    last = api.get("/api/v1/products", params={"page_size": 2, "page": 3})
    assert _names(last) == ["Fern Toner"]


def test_page_beyond_the_last_is_empty_not_an_error(
    api: TestClient, catalogue: dict[str, Any]
) -> None:
    response = api.get("/api/v1/products", params={"page": 50})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["items"] == []
    assert response.json()["total"] == 5


@pytest.mark.parametrize(
    "params",
    [
        {"page_size": 101},
        {"page_size": 0},
        {"page": 0},
        {"sort": "popularity"},
        {"min_price": -1},
        {"min_price": "abc"},
        {"min_price": 500, "max_price": 100},
        {"category": "Bad_Slug"},
        {"category": "x" * 201},
        {"unknown": "1"},
    ],
    ids=[
        "page-size-too-big",
        "page-size-zero",
        "page-zero",
        "invalid-sort",
        "negative-price",
        "non-numeric-price",
        "min-above-max",
        "bad-category-slug",
        "long-category-slug",
        "unknown-parameter",
    ],
)
def test_invalid_query_is_rejected(
    api: TestClient, catalogue: dict[str, Any], params: dict[str, Any]
) -> None:
    assert api.get("/api/v1/products", params=params).status_code == (
        status.HTTP_422_UNPROCESSABLE_CONTENT
    )


@pytest.mark.parametrize(
    "sort, expected",
    [
        ("name_asc", "ABCDF"),
        ("name_desc", "FDCBA"),
        ("price_asc", "BADCF"),
        ("price_desc", "DABCF"),
        ("newest", "FDCBA"),
    ],
)
def test_sort_orders(api: TestClient, catalogue: dict[str, Any], sort: str, expected: str) -> None:
    """Expected orders by initial letter. Unknown prices (C, F) sort last for both."""
    names = _names(api.get("/api/v1/products", params={"sort": sort}))
    assert "".join(name[0] for name in names) == expected


def test_category_filter_includes_subcategories(api: TestClient, catalogue: dict[str, Any]) -> None:
    face = api.get("/api/v1/products", params={"category": "face"})
    assert _names(face) == ["Apricot Scrub", "Birch Cream", "Daisy Balm", "Fern Toner"]
    assert face.json()["total"] == 4

    cream = api.get("/api/v1/products", params={"category": "face-cream"})
    assert _names(cream) == ["Birch Cream", "Fern Toner"]


def test_unknown_category_returns_no_products(api: TestClient, catalogue: dict[str, Any]) -> None:
    response = api.get("/api/v1/products", params={"category": "no-such-category"})
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 24}


def test_price_filters_exclude_unknown_prices(api: TestClient, catalogue: dict[str, Any]) -> None:
    response = api.get("/api/v1/products", params={"min_price": "1000", "max_price": "2500"})
    assert _names(response) == ["Apricot Scrub", "Daisy Balm"]
    assert _names(api.get("/api/v1/products", params={"min_price": 0})) == [
        "Apricot Scrub",
        "Birch Cream",
        "Daisy Balm",
    ]


def test_cyclic_category_data_does_not_loop(
    api: TestClient, db_session: Session, catalogue: dict[str, Any]
) -> None:
    face, body = catalogue["face"], catalogue["body"]
    db_session.execute(
        text("UPDATE categories SET parent_id = :body WHERE id = :face"),
        {"body": body.id, "face": face.id},
    )
    db_session.execute(
        text("UPDATE categories SET parent_id = :face WHERE id = :body"),
        {"face": face.id, "body": body.id},
    )

    response = api.get("/api/v1/products", params={"category": "body"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["total"] == 5  # body and face (its cyclic descendant) combined


# --- Detail -------------------------------------------------------------------------


def test_detail_returns_full_product(api: TestClient, catalogue: dict[str, Any]) -> None:
    response = api.get("/api/v1/products/daisy-balm")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["name"] == "Daisy Balm"
    assert body["sku"] == "DEV-0004"
    assert body["price_pkr"] == "2500.00"
    assert body["description"] == "Description of Daisy Balm"
    assert [image["url"] for image in body["images"]] == [
        "http://localhost:3000/dev-fixture/4-0.svg",
        "http://localhost:3000/dev-fixture/4-1.svg",
    ]
    assert body["categories"] == [
        {"slug": "body", "name": "Body"},
        {"slug": "face", "name": "Face"},
    ]
    assert body["source_url"] == "http://localhost:3000/dev-fixture/products/src-4"
    assert body["last_synced_at"].startswith("2026-10-26T00:00:00")
    assert body["availability"] == {
        "status": "not_confirmed",
        "label": "Check availability at Oriflame",
        "checked_at": None,
    }
    assert body["is_development_data"] is True


def test_related_products_share_a_category_and_exclude_hidden_and_self(
    api: TestClient, db_session: Session, catalogue: dict[str, Any]
) -> None:
    for n in range(7, 12):
        _product(db_session, n, f"Zinnia {n}", categories=[catalogue["face"]])
    db_session.flush()

    related = api.get("/api/v1/products/apricot-scrub").json()["related"]

    names = [item["name"] for item in related]
    assert names == ["Daisy Balm", "Zinnia 10", "Zinnia 11", "Zinnia 7"]  # limit 4, by name
    assert "Elm Hidden" not in names
    assert "Apricot Scrub" not in names


def test_product_without_categories_has_no_related(
    api: TestClient, db_session: Session, catalogue: dict[str, Any]
) -> None:
    _product(db_session, 20, "Lonely Oil")
    db_session.flush()
    assert api.get("/api/v1/products/lonely-oil").json()["related"] == []


@pytest.mark.parametrize("slug", ["elm-hidden", "no-such-product"])
def test_hidden_or_unknown_product_is_404_with_safe_message(
    api: TestClient, catalogue: dict[str, Any], slug: str
) -> None:
    response = api.get(f"/api/v1/products/{slug}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Product not found"}


@pytest.mark.parametrize(
    "slug", ["Daisy-Balm", "daisy_balm", "daisy--balm", "-daisy", "daisy%27%20OR%201=1", "x" * 201]
)
def test_invalid_slug_is_rejected_before_the_database(
    api: TestClient, slug: str, monkeypatch: pytest.MonkeyPatch
) -> None:

    def must_not_run(*_: object) -> None:
        pytest.fail("an invalid slug reached the database")

    monkeypatch.setattr(service_module, "get_visible_product", must_not_run)
    assert api.get(f"/api/v1/products/{slug}").status_code == (
        status.HTTP_422_UNPROCESSABLE_CONTENT
    )


def test_featured_filter(api: TestClient, db_session: Session, catalogue: dict[str, Any]) -> None:
    db_session.execute(
        text("UPDATE products SET is_featured = true WHERE name IN ('Birch Cream', 'Elm Hidden')")
    )
    featured = api.get("/api/v1/products", params={"featured": "true"})
    assert _names(featured) == ["Birch Cream"]  # hidden products stay hidden
    others = api.get("/api/v1/products", params={"featured": "false"})
    assert "Birch Cream" not in _names(others)
    assert others.json()["total"] == 4
    assert api.get("/api/v1/products", params={"featured": "maybe"}).status_code == (
        status.HTTP_422_UNPROCESSABLE_CONTENT
    )
