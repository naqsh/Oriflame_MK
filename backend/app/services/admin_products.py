"""Owner control over product visibility and featuring (OR-048).

Only ``is_visible`` and ``is_featured`` change here; product facts (name, price,
availability) stay as the catalogue source provides them. A sync never writes these two
flags (it writes ``listed_by_source``), so the owner's choice survives every sync.

Rules: a product must be shown, and still listed by the source, before it can be
featured. Hiding a featured product also unfeatures it, and the message says so.
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models import AdminUser, Product
from backend.app.repositories import admin_products
from backend.app.schemas.admin import ProductFlagsUpdate
from backend.app.services import audit


class ProductNotFoundError(Exception):
    """No product has this slug (hidden and unlisted products included)."""


class ProductUpdateRefusedError(Exception):
    """The change breaks a rule; the message is safe to show the admin."""


@dataclass(frozen=True)
class FlagsResult:
    product: Product
    message: str


class AdminProductService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def page(self, *, q: str | None, page: int, page_size: int) -> tuple[list[Product], int]:
        return admin_products.page(self._session, q=q, page=page, page_size=page_size)

    def update_flags(self, admin: AdminUser, slug: str, change: ProductFlagsUpdate) -> FlagsResult:
        product = admin_products.for_update(self._session, slug)
        if product is None:
            raise ProductNotFoundError(slug)

        visible = product.is_visible if change.is_visible is None else change.is_visible
        featured = product.is_featured if change.is_featured is None else change.is_featured
        if change.is_featured and not visible:
            raise ProductUpdateRefusedError("Show the product before featuring it.")
        if change.is_featured and not product.listed_by_source:
            raise ProductUpdateRefusedError(
                "The catalogue source no longer lists this product, so it cannot be featured."
            )
        notes: list[str] = []
        if not visible and featured:
            featured = False
            notes.append("It was also removed from featured products.")

        changes = {
            name: {"from": old, "to": new}
            for name, old, new in (
                ("is_visible", product.is_visible, visible),
                ("is_featured", product.is_featured, featured),
            )
            if old != new
        }
        if not changes:
            self._session.rollback()
            return FlagsResult(product, "No change.")

        product.is_visible = visible
        product.is_featured = featured
        audit.record(
            self._session,
            audit.PRODUCT_FLAGS_UPDATED,
            admin_user_id=admin.id,
            target_type="product",
            target_id=slug,
            details={"changes": changes},
        )
        self._session.commit()
        return FlagsResult(product, " ".join([_describe(product), *notes]))


def _describe(product: Product) -> str:
    if not product.is_visible:
        return "Hidden from the storefront."
    if not product.listed_by_source:
        return "Shown, but the catalogue source no longer lists it, so visitors cannot see it."
    return "Featured on the homepage." if product.is_featured else "Shown on the storefront."


def get_admin_product_service(db: Annotated[Session, Depends(get_db)]) -> AdminProductService:
    return AdminProductService(db)
