"""Admin product table and owner flags (OR-048) on PostgreSQL."""

from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.passwords import hash_password
from backend.app.core.security import require_admin
from backend.app.models import AdminUser, AuditLog, Product
from backend.app.repositories import admin_users
from backend.app.services import audit

pytestmark = pytest.mark.db

SYNCED = datetime(2026, 10, 26, 9, 0, tzinfo=UTC)


@pytest.fixture
def admin(db_session: Session) -> AdminUser:
    user = admin_users.create(
        db_session, email="owner@example.pk", password_hash=hash_password("x" * 12)
    )
    db_session.commit()
    return user


@pytest.fixture
def api(db_app: FastAPI, admin: AdminUser) -> Iterator[TestClient]:
    db_app.dependency_overrides[require_admin] = lambda: admin
    with TestClient(db_app, raise_server_exceptions=False) as client:
        yield client


def add_product(
    session: Session,
    n: int,
    *,
    name: str | None = None,
    visible: bool = True,
    featured: bool = False,
    listed: bool = True,
) -> Product:
    product = Product(
        source_id=f"src-{n}",
        source="dev_fixture",
        slug=f"sample-product-{n:02d}",
        name=name or f"Sample Product {n:02d}",
        sku=f"DEV-{n:04d}",
        price_pkr=Decimal("1499.00"),
        source_url=f"http://localhost:3000/dev-fixture/products/src-{n}",
        last_synced_at=SYNCED,
        is_visible=visible,
        is_featured=featured,
        listed_by_source=listed,
    )
    session.add(product)
    session.commit()
    return product


def flags(session: Session, slug: str) -> tuple[bool, bool]:
    session.expire_all()
    product = session.scalars(select(Product).where(Product.slug == slug)).one()
    return product.is_visible, product.is_featured


def audit_rows(session: Session) -> list[AuditLog]:
    return list(session.scalars(select(AuditLog).order_by(AuditLog.id)))


class TestList:
    def test_lists_every_product_with_flags_including_hidden_and_unlisted(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1)
        add_product(db_session, 2, visible=False)
        add_product(db_session, 3, listed=False)

        response = api.get("/api/v1/admin/products")

        assert response.status_code == status.HTTP_200_OK
        assert response.headers["cache-control"] == "no-store"
        body = response.json()
        assert body["total"] == 3
        by_slug = {item["slug"]: item for item in body["items"]}
        assert by_slug["sample-product-01"]["on_storefront"] is True
        assert by_slug["sample-product-02"]["on_storefront"] is False
        assert by_slug["sample-product-03"] | {"last_synced_at": None} == {
            "slug": "sample-product-03",
            "name": "Sample Product 03",
            "sku": "DEV-0003",
            "source": "dev_fixture",
            "price_pkr": "1499.00",
            "last_synced_at": None,
            "is_visible": True,
            "is_featured": False,
            "listed_by_source": False,
            "on_storefront": False,
        }

    def test_searches_name_sku_and_slug_and_paginates(
        self, api: TestClient, db_session: Session
    ) -> None:
        for n in range(1, 6):
            add_product(db_session, n)
        add_product(db_session, 6, name="Rose Cream")

        assert api.get("/api/v1/admin/products", params={"q": "rose"}).json()["total"] == 1
        assert api.get("/api/v1/admin/products", params={"q": "DEV-0002"}).json()["total"] == 1
        assert api.get("/api/v1/admin/products", params={"q": "product-03"}).json()["total"] == 1
        page = api.get("/api/v1/admin/products", params={"page": 2, "page_size": 4}).json()
        assert (page["total"], len(page["items"])) == (6, 2)

    def test_like_wildcards_in_the_query_match_literally(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1)
        assert api.get("/api/v1/admin/products", params={"q": "%"}).json()["total"] == 0
        assert api.get("/api/v1/admin/products", params={"q": "_"}).json()["total"] == 0

    def test_rejects_unknown_parameters_and_long_queries(self, api: TestClient) -> None:
        assert api.get("/api/v1/admin/products", params={"hidden": "1"}).status_code == 422
        assert api.get("/api/v1/admin/products", params={"q": "x" * 101}).status_code == 422


class TestUpdate:
    def test_hide_and_show_are_audited_and_reach_the_storefront(
        self, api: TestClient, db_session: Session, admin: AdminUser
    ) -> None:
        add_product(db_session, 1)

        response = api.patch("/api/v1/admin/products/sample-product-01", json={"is_visible": False})

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["message"] == "Hidden from the storefront."
        assert response.json()["product"]["on_storefront"] is False
        assert flags(db_session, "sample-product-01") == (False, False)
        assert api.get("/api/v1/products/sample-product-01").status_code == 404
        assert api.get("/api/v1/products").json()["total"] == 0

        api.patch("/api/v1/admin/products/sample-product-01", json={"is_visible": True})
        assert api.get("/api/v1/products/sample-product-01").status_code == 200

        rows = audit_rows(db_session)
        assert [(row.action, row.target_type, row.target_id) for row in rows] == [
            (audit.PRODUCT_FLAGS_UPDATED, "product", "sample-product-01"),
        ] * 2
        assert rows[0].admin_user_id == admin.id
        assert rows[0].details == {"changes": {"is_visible": {"from": True, "to": False}}}

    def test_featuring_shows_the_product_in_the_featured_listing(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1)
        add_product(db_session, 2)

        response = api.patch("/api/v1/admin/products/sample-product-02", json={"is_featured": True})

        assert response.json()["message"] == "Featured on the homepage."
        featured = api.get("/api/v1/products", params={"featured": "true"}).json()
        assert [item["slug"] for item in featured["items"]] == ["sample-product-02"]

    def test_featuring_a_hidden_product_is_refused(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1, visible=False)

        response = api.patch("/api/v1/admin/products/sample-product-01", json={"is_featured": True})

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.json()["detail"] == "Show the product before featuring it."
        assert flags(db_session, "sample-product-01") == (False, False)
        assert audit_rows(db_session) == []

    def test_showing_and_featuring_together_is_allowed(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1, visible=False)
        response = api.patch(
            "/api/v1/admin/products/sample-product-01",
            json={"is_visible": True, "is_featured": True},
        )
        assert response.status_code == status.HTTP_200_OK
        assert flags(db_session, "sample-product-01") == (True, True)

    def test_featuring_a_product_the_source_no_longer_lists_is_refused(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1, listed=False)
        response = api.patch("/api/v1/admin/products/sample-product-01", json={"is_featured": True})
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "no longer lists" in response.json()["detail"]

    def test_hiding_a_featured_product_also_unfeatures_it_and_says_so(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1, featured=True)

        response = api.patch("/api/v1/admin/products/sample-product-01", json={"is_visible": False})

        assert response.json()["message"] == (
            "Hidden from the storefront. It was also removed from featured products."
        )
        assert flags(db_session, "sample-product-01") == (False, False)
        assert audit_rows(db_session)[0].details == {
            "changes": {
                "is_visible": {"from": True, "to": False},
                "is_featured": {"from": True, "to": False},
            }
        }

    def test_showing_an_unlisted_product_explains_it_stays_off_the_storefront(
        self, api: TestClient, db_session: Session
    ) -> None:
        add_product(db_session, 1, visible=False, listed=False)
        response = api.patch("/api/v1/admin/products/sample-product-01", json={"is_visible": True})
        assert response.json()["message"].startswith("Shown, but the catalogue source no longer")
        assert response.json()["product"]["on_storefront"] is False

    def test_no_change_is_not_audited(self, api: TestClient, db_session: Session) -> None:
        add_product(db_session, 1)
        response = api.patch("/api/v1/admin/products/sample-product-01", json={"is_visible": True})
        assert response.json()["message"] == "No change."
        assert audit_rows(db_session) == []

    @pytest.mark.parametrize(
        "body",
        [
            {"name": "Cheaper"},
            {"price_pkr": "1.00"},
            {"is_visible": False, "availability": "in_stock"},
            {"is_visible": "false"},
            {"is_featured": 1},
            {},
        ],
    )
    def test_product_facts_and_loose_values_are_rejected(
        self, api: TestClient, db_session: Session, body: dict[str, object]
    ) -> None:
        add_product(db_session, 1)
        response = api.patch("/api/v1/admin/products/sample-product-01", json=body)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert flags(db_session, "sample-product-01") == (True, False)

    def test_unknown_and_malformed_slugs(self, api: TestClient) -> None:
        unknown = api.patch("/api/v1/admin/products/no-such-product", json={"is_visible": False})
        assert unknown.status_code == status.HTTP_404_NOT_FOUND
        assert unknown.json()["detail"] == "Product not found"
        malformed = api.patch("/api/v1/admin/products/Not_A_Slug", json={"is_visible": False})
        assert malformed.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_requires_an_admin_session(db_app: FastAPI) -> None:
    with TestClient(db_app) as client:
        assert client.get("/api/v1/admin/products").status_code == 401
        response = client.patch(
            "/api/v1/admin/products/sample-product-01", json={"is_visible": False}
        )
        assert response.status_code == 401
