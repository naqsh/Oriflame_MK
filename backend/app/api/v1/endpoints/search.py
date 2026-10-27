"""GET /api/v1/search (OR-020). No logic here.

Rate limited per client (OR-050): search runs full-text and fuzzy queries, the most
expensive public read.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from backend.app.core.rate_limit import RateLimiter, rate_limit_dependency
from backend.app.schemas.products import ProductPage, SearchQuery
from backend.app.services.products import ProductService, get_product_service

SEARCH_LIMIT_PER_MINUTE = 60
search_limiter = RateLimiter(limit=SEARCH_LIMIT_PER_MINUTE)

router = APIRouter(prefix="/search", tags=["search"])


@router.get(
    "",
    response_model=ProductPage,
    dependencies=[Depends(rate_limit_dependency(search_limiter))],
)
def search_products(
    query: Annotated[SearchQuery, Query()],
    service: Annotated[ProductService, Depends(get_product_service)],
) -> ProductPage:
    """Visible products matching ``q``: full-text ranking, then fuzzy name matching."""
    return service.search(query)
