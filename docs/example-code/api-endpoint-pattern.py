"""Paginated, typed FastAPI endpoint: router -> service -> repository.

A condensed version of backend/app/api/v1/endpoints/products.py,
backend/app/services/products.py and backend/app/repositories/product_reads.py
(OR-018). The router holds no logic; the service shapes responses; the repository
holds the SQL.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models import Product
from backend.app.schemas.errors import ErrorResponse
from backend.app.schemas.products import SLUG_PATTERN


# --- Schemas: one query model, so unknown or invalid parameters are a 422 -----------
class ItemQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, ge=1, le=10_000)
    page_size: int = Field(default=24, ge=1, le=100)


class ItemOut(BaseModel):
    slug: str
    name: str


class ItemPage(BaseModel):
    items: list[ItemOut]
    total: int
    page: int
    page_size: int


# --- Repository: SQL only, bound parameters, visible rows only ------------------------
def count_visible(session: Session) -> int:
    query = select(func.count()).select_from(Product).where(Product.is_visible.is_(True))
    return session.scalar(query) or 0


def page_of_visible(session: Session, page: int, page_size: int) -> list[Product]:
    return list(
        session.scalars(
            select(Product)
            .where(Product.is_visible.is_(True))
            .order_by(func.lower(Product.name), Product.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )


# --- Service: business rules and response shapes --------------------------------------
class ItemNotFoundError(LookupError):
    pass


class ItemService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list(self, query: ItemQuery) -> ItemPage:
        rows = page_of_visible(self._session, query.page, query.page_size)
        return ItemPage(
            items=[ItemOut(slug=p.slug, name=p.name) for p in rows],
            total=count_visible(self._session),  # a page past the end is empty, not an error
            page=query.page,
            page_size=query.page_size,
        )

    def get(self, slug: str) -> ItemOut:
        product = self._session.scalars(
            select(Product).where(Product.slug == slug, Product.is_visible.is_(True))
        ).one_or_none()
        if product is None:
            raise ItemNotFoundError(slug)
        return ItemOut(slug=product.slug, name=product.name)


def get_item_service(db: Annotated[Session, Depends(get_db)]) -> ItemService:
    return ItemService(db)


# --- Router: validation, dependency wiring and HTTP mapping only ----------------------
router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=ItemPage)
def list_items(
    query: Annotated[ItemQuery, Query()],
    service: Annotated[ItemService, Depends(get_item_service)],
) -> ItemPage:
    return service.list(query)


@router.get(
    "/{slug}",
    response_model=ItemOut,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
)
def get_item(
    # Malformed slugs are rejected (422) before any query runs.
    slug: Annotated[str, Path(min_length=1, max_length=200, pattern=SLUG_PATTERN)],
    service: Annotated[ItemService, Depends(get_item_service)],
) -> ItemOut:
    try:
        return service.get(slug)
    except ItemNotFoundError:
        # A safe, fixed message: never echo input or internals.
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Item not found") from None
