"""GET /api/v1/search (OR-020). No logic here.

Rate limiting is deferred to OR-E6, which adds one shared limiter for all public
endpoints (documented in backend/AGENT.md).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from backend.app.schemas.products import ProductPage, SearchQuery
from backend.app.services.products import ProductService, get_product_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=ProductPage)
def search_products(
    query: Annotated[SearchQuery, Query()],
    service: Annotated[ProductService, Depends(get_product_service)],
) -> ProductPage:
    """Visible products matching ``q``: full-text ranking, then fuzzy name matching."""
    return service.search(query)
