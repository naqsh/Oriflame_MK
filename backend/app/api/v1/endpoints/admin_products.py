"""Admin product table and owner flags (OR-048). No logic here."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from backend.app.core.security import CurrentAdmin
from backend.app.schemas.admin import (
    AdminProductEntry,
    AdminProductQuery,
    AdminProductsPage,
    ProductFlagsUpdate,
    ProductFlagsUpdated,
)
from backend.app.schemas.errors import ErrorResponse
from backend.app.schemas.products import SLUG_PATTERN
from backend.app.services.admin_products import (
    AdminProductService,
    ProductNotFoundError,
    ProductUpdateRefusedError,
    get_admin_product_service,
)

router = APIRouter(prefix="/products", tags=["admin"])

Service = Annotated[AdminProductService, Depends(get_admin_product_service)]


@router.get("", response_model=AdminProductsPage)
def list_products(
    params: Annotated[AdminProductQuery, Query()], response: Response, service: Service
) -> AdminProductsPage:
    response.headers["Cache-Control"] = "no-store"
    rows, total = service.page(q=params.q, page=params.page, page_size=params.page_size)
    return AdminProductsPage(
        items=[AdminProductEntry.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.patch(
    "/{slug}",
    response_model=ProductFlagsUpdated,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
    },
)
def update_product_flags(
    slug: Annotated[str, Path(min_length=1, max_length=200, pattern=SLUG_PATTERN)],
    body: ProductFlagsUpdate,
    admin: CurrentAdmin,
    service: Service,
) -> ProductFlagsUpdated:
    try:
        result = service.update_flags(admin, slug, body)
    except ProductNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product not found") from exc
    except ProductUpdateRefusedError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return ProductFlagsUpdated(
        product=AdminProductEntry.model_validate(result.product), message=result.message
    )
