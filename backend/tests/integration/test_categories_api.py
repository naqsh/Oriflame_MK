"""GET /api/v1/categories and /api/v1/categories/{slug} against real PostgreSQL (OR-019)."""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.models import Category, Product

pytestmark = pytest.mark.db


@pytest.fixture
def api(db_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


def _product(session: Session, n: int, categories: list[Category], *, visible: bool = True) -> None:
    session.add(
        Product(
            source_id=f"src-{n}",
            source="dev_fixture",
            slug=f"sample-product-{n}",
            name=f"Sample Product {n}",
            source_url=f"http://localhost:3000/dev-fixture/products/src-{n}",
            last_synced_at=datetime(2026, 10, 26, tzinfo=UTC),
            is_visible=visible,
            categories=categories,
        )
    )


@pytest.fixture
def categories(db_session: Session) -> dict[str, Category]:
    face = Category(source_id="c1", slug="face", name="Face")
    cream = Category(source_id="c2", slug="face-cream", name="Face Cream", parent=face)
    night = Category(source_id="c3", slug="night-cream", name="Night Cream", parent=cream)
    eyes = Category(source_id="c4", slug="eyes", name="Eyes", parent=face)
    body = Category(source_id="c5", slug="body", name="Body")
    empty = Category(source_id="c6", slug="accessories", name="Accessories")
    db_session.add_all([face, cream, night, eyes, body, empty])
    _product(db_session, 1, [face])
    _product(db_session, 2, [cream, face])  # in parent and child: counted once
    _product(db_session, 3, [night])
    _product(db_session, 4, [night], visible=False)  # never counted
    _product(db_session, 5, [body])
    db_session.flush()
    return {"face": face, "cream": cream, "night": night, "eyes": eyes, "body": body}


def _summary(node: dict[str, Any]) -> tuple[str, int, list[Any]]:
    return node["slug"], node["product_count"], [_summary(c) for c in node["children"]]


def test_tree_nesting_and_counts(api: TestClient, categories: dict[str, Category]) -> None:
    response = api.get("/api/v1/categories")

    assert response.status_code == status.HTTP_200_OK
    assert [_summary(node) for node in response.json()["items"]] == [
        ("accessories", 0, []),  # empty categories are included
        ("body", 1, []),
        (
            "face",
            3,
            [
                ("eyes", 0, []),
                ("face-cream", 2, [("night-cream", 1, [])]),
            ],
        ),
    ]
    face = response.json()["items"][2]
    assert face["name"] == "Face"


def test_counts_match_the_products_endpoint(
    api: TestClient, categories: dict[str, Category]
) -> None:
    for slug, expected in [("face", 3), ("face-cream", 2), ("night-cream", 1), ("eyes", 0)]:
        listed = api.get("/api/v1/products", params={"category": slug}).json()["total"]
        detail = api.get(f"/api/v1/categories/{slug}").json()["product_count"]
        assert listed == detail == expected


def test_detail_has_ancestor_path_and_children(
    api: TestClient, categories: dict[str, Category]
) -> None:
    response = api.get("/api/v1/categories/night-cream")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "slug": "night-cream",
        "name": "Night Cream",
        "product_count": 1,
        "ancestors": [
            {"slug": "face", "name": "Face"},
            {"slug": "face-cream", "name": "Face Cream"},
        ],
        "children": [],
    }

    face = api.get("/api/v1/categories/face").json()
    assert face["ancestors"] == []
    assert face["children"] == [
        {"slug": "eyes", "name": "Eyes", "product_count": 0},
        {"slug": "face-cream", "name": "Face Cream", "product_count": 2},
    ]


def test_unknown_category_is_404(api: TestClient, categories: dict[str, Category]) -> None:
    response = api.get("/api/v1/categories/no-such-category")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"detail": "Category not found"}


@pytest.mark.parametrize("slug", ["Face", "face_cream", "face--cream", "x" * 201])
def test_invalid_slug_is_422(api: TestClient, slug: str) -> None:
    assert api.get(f"/api/v1/categories/{slug}").status_code == (
        status.HTTP_422_UNPROCESSABLE_CONTENT
    )


def test_empty_catalogue_gives_an_empty_tree(api: TestClient) -> None:
    assert api.get("/api/v1/categories").json() == {"items": []}


def test_cyclic_parents_are_broken_safely(
    api: TestClient, db_session: Session, categories: dict[str, Category]
) -> None:
    face, night = categories["face"], categories["night"]
    db_session.execute(
        text("UPDATE categories SET parent_id = :night WHERE id = :face"),
        {"night": night.id, "face": face.id},
    )  # face -> night -> face-cream -> face

    tree = api.get("/api/v1/categories")
    detail = api.get("/api/v1/categories/night-cream")

    assert tree.status_code == detail.status_code == status.HTTP_200_OK
    slugs: list[str] = []

    def walk(nodes: list[dict[str, Any]]) -> None:
        for node in nodes:
            slugs.append(node["slug"])
            walk(node["children"])

    walk(tree.json()["items"])
    assert sorted(slugs) == sorted(
        ["accessories", "body", "eyes", "face", "face-cream", "night-cream"]
    )  # each category exactly once
    # face has the lowest id in the cycle, so it is treated as top-level again.
    assert [node["slug"] for node in tree.json()["items"]] == ["accessories", "body", "face"]
    assert [a["slug"] for a in detail.json()["ancestors"]] == ["face", "face-cream"]
