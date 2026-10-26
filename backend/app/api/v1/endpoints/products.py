"""GET /api/v1/products and /api/v1/products/{slug} (OR-018). No logic here."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from backend.app.schemas.errors import ErrorResponse
from backend.app.schemas.products import SLUG_PATTERN, ProductDetail, ProductPage, ProductQuery
from backend.app.services.products import (
    ProductNotFoundError,
    ProductService,
    get_product_service,
)

PRODUCT_NOT_FOUND = "Product not found"

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductPage)
def list_products(
    query: Annotated[ProductQuery, Query()],
    service: Annotated[ProductService, Depends(get_product_service)],
) -> ProductPage:
    """Visible products, filtered, sorted and paginated."""
    return service.list(query)


@router.get(
    "/{slug}",
    response_model=ProductDetail,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
)
def get_product(
    slug: Annotated[str, Path(min_length=1, max_length=200, pattern=SLUG_PATTERN)],
    service: Annotated[ProductService, Depends(get_product_service)],
) -> ProductDetail:
    try:
        return service.get(slug)
    except ProductNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=PRODUCT_NOT_FOUND) from None
