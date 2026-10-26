"""GET /api/v1/categories and /api/v1/categories/{slug} (OR-019). No logic here.

Products in a category are served by GET /api/v1/products?category={slug}.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from backend.app.schemas.categories import CategoryDetail, CategoryTree
from backend.app.schemas.errors import ErrorResponse
from backend.app.schemas.products import SLUG_PATTERN
from backend.app.services.categories import (
    CategoryNotFoundError,
    CategoryService,
    get_category_service,
)

CATEGORY_NOT_FOUND = "Category not found"

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=CategoryTree)
def list_categories(
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> CategoryTree:
    """The full category tree with visible product counts (empty categories included)."""
    return service.tree()


@router.get(
    "/{slug}",
    response_model=CategoryDetail,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
)
def get_category(
    slug: Annotated[str, Path(min_length=1, max_length=200, pattern=SLUG_PATTERN)],
    service: Annotated[CategoryService, Depends(get_category_service)],
) -> CategoryDetail:
    try:
        return service.get(slug)
    except CategoryNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=CATEGORY_NOT_FOUND) from None
