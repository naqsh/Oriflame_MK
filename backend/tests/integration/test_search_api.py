"""GET /api/v1/search against real PostgreSQL (OR-020)."""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models import Product

pytestmark = pytest.mark.db


@pytest.fixture
def api(db_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


def _add(
    session: Session, n: int, name: str, description: str = "", *, visible: bool = True
) -> None:
    session.add(
        Product(
            source_id=f"src-{n}",
            source="dev_fixture",
            slug=f"product-{n}",
            name=name,
            description=description or None,
            source_url=f"http://localhost:3000/dev-fixture/products/src-{n}",
            last_synced_at=datetime(2026, 10, 26, tzinfo=UTC),
            is_visible=visible,
        )
    )


@pytest.fixture
def catalogue(db_session: Session) -> None:
    _add(db_session, 1, "Hand Cream", "Rich cream for dry hands.")
    _add(db_session, 2, "Hand Cream Deluxe", "A larger hand cream.")
    _add(db_session, 3, "Body Lotion", "Light lotion; also works as a hand cream.")
    _add(db_session, 4, "Peach Glow Perfector", "Adds a soft glow.")
    _add(db_session, 5, "Glow Hidden Serum", "Hidden glow product.", visible=False)
    _add(db_session, 6, "گلاب کریم", "Rose cream with an Urdu name.")
    _add(db_session, 7, "Peachy Hidden Balm", visible=False)
    db_session.flush()


def _search(api: TestClient, q: str, **params: Any) -> Any:
    return api.get("/api/v1/search", params={"q": q, **params})


def _names(response: Any) -> list[str]:
    return [item["name"] for item in response.json()["items"]]


def test_generated_search_vector_is_populated(db_session: Session, catalogue: None) -> None:
    empty = db_session.scalar(
        select(func.count()).select_from(Product).where(Product.search_vector.is_(None))
    )
    assert empty == 0


def test_exact_name_match_ranks_first(api: TestClient, catalogue: None) -> None:
    response = _search(api, "hand cream")

    assert response.status_code == status.HTTP_200_OK
    names = _names(response)
    assert names[0] == "Hand Cream"
    assert set(names) >= {"Hand Cream", "Hand Cream Deluxe", "Body Lotion"}


def test_name_matches_rank_above_description_matches(api: TestClient, catalogue: None) -> None:
    names = _names(_search(api, "hand cream deluxe"))
    assert names[0] == "Hand Cream Deluxe"
    names = _names(_search(api, "lotion"))
    assert names == ["Body Lotion"]


def test_partial_and_stemmed_queries(api: TestClient, catalogue: None) -> None:
    assert _names(_search(api, "glow")) == ["Peach Glow Perfector"]  # hidden serum excluded
    assert "Hand Cream" in _names(_search(api, "creams"))


@pytest.mark.parametrize("q", ["peech", "perfecter", "hnad cream"])
def test_misspelled_queries_fall_back_to_fuzzy_name_matching(
    api: TestClient, catalogue: None, q: str
) -> None:
    names = _names(_search(api, q))
    assert names, f"no fuzzy results for {q!r}"
    assert "Peachy Hidden Balm" not in names
    assert names[0] in {"Peach Glow Perfector", "Hand Cream"}


def test_unrelated_query_returns_empty(api: TestClient, catalogue: None) -> None:
    response = _search(api, "zzqxv")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 24}


@pytest.mark.parametrize(
    "q",
    [
        "'; DROP TABLE products;--",
        '"hand cream" OR -lotion',
        "&|!():*<->",
        "cream:*",
        "\\",
        "%_%",
    ],
)
def test_special_characters_are_handled_safely(
    api: TestClient, db_session: Session, catalogue: None, q: str
) -> None:
    response = _search(api, q)
    assert response.status_code == status.HTTP_200_OK
    assert db_session.scalar(select(func.count()).select_from(Product)) == 7


def test_urdu_queries_work(api: TestClient, catalogue: None) -> None:
    assert _names(_search(api, "کریم")) == ["گلاب کریم"]
    response = _search(api, "سلام")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["items"] == []


@pytest.mark.parametrize("q", ["glow", "hidden", "serum", "peachy"])
def test_hidden_products_never_appear(api: TestClient, catalogue: None, q: str) -> None:
    names = _names(_search(api, q))
    assert "Glow Hidden Serum" not in names
    assert "Peachy Hidden Balm" not in names


def test_pagination_and_response_shape(api: TestClient, catalogue: None) -> None:
    response = _search(api, "cream", page_size=2, page=2)
    body = response.json()
    assert (body["total"], body["page"], body["page_size"]) == (4, 2, 2)
    assert len(body["items"]) == 2
    item = body["items"][0]
    assert set(item) == {
        "slug",
        "name",
        "price_pkr",
        "currency",
        "primary_image",
        "availability",
        "data_source",
        "is_development_data",
    }


def test_query_is_trimmed(api: TestClient, catalogue: None) -> None:
    assert _names(_search(api, "   glow   ")) == ["Peach Glow Perfector"]


@pytest.mark.parametrize(
    "params",
    [
        {"q": ""},
        {"q": "   "},
        {"q": "x" * 101},
        {},
        {"q": "cream", "page_size": 101},
        {"q": "cream", "sort": "name_asc"},
    ],
    ids=["empty", "blank", "too-long", "missing", "page-size", "unknown-parameter"],
)
def test_invalid_search_is_422(api: TestClient, params: dict[str, Any]) -> None:
    assert api.get("/api/v1/search", params=params).status_code == (
        status.HTTP_422_UNPROCESSABLE_CONTENT
    )


def test_maximum_length_query_is_accepted(api: TestClient, catalogue: None) -> None:
    assert _search(api, "c" * 100).status_code == status.HTTP_200_OK
