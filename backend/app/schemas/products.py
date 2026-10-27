"""Public product API models (OR-018).

Prices are ``Decimal`` and serialise as strings (``"1499.00"``) so no precision is
lost; ``null`` means the source gave no price and the UI shows "Price not available".
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 24
SEARCH_MAX_LENGTH = 100

Slug = Annotated[str, Field(min_length=1, max_length=200, pattern=SLUG_PATTERN)]
ProductSort = Literal["name_asc", "name_desc", "price_asc", "price_desc", "newest"]
AvailabilityStatus = Literal["verified_in_stock", "verified_out_of_stock", "not_confirmed"]


class ProductQuery(BaseModel):
    """Query string for GET /api/v1/products. Unknown parameters are rejected (422)."""

    model_config = ConfigDict(extra="forbid")

    category: Slug | None = None
    # true: only products the owner marked featured; false: only the others.
    featured: bool | None = None
    min_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    max_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    sort: ProductSort = "name_asc"
    page: int = Field(default=1, ge=1, le=10_000)
    page_size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @model_validator(mode="after")
    def _price_range(self) -> Self:
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            raise ValueError("min_price must not be greater than max_price")
        return self


class SearchQuery(BaseModel):
    """Query string for GET /api/v1/search. ``q`` is trimmed and must be 1 to 100 chars."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    q: str = Field(min_length=1, max_length=SEARCH_MAX_LENGTH)
    page: int = Field(default=1, ge=1, le=10_000)
    page_size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)


class Availability(BaseModel):
    status: AvailabilityStatus
    label: str
    checked_at: datetime | None


class ImageOut(BaseModel):
    url: str
    alt_text: str


class CategoryRef(BaseModel):
    slug: str
    name: str


class ProductSummary(BaseModel):
    slug: str
    name: str
    price_pkr: Decimal | None
    currency: Literal["PKR"]
    primary_image: ImageOut | None
    availability: Availability
    # Catalogue source name; "dev_fixture" means development data the UI must flag.
    data_source: str
    is_development_data: bool
    # When the source last listed this product (sitemap lastmod, honest freshness).
    last_synced_at: datetime


class ProductPage(BaseModel):
    items: list[ProductSummary]
    total: int
    page: int
    page_size: int


class ProductDetail(ProductSummary):
    sku: str | None
    description: str | None
    images: list[ImageOut]
    categories: list[CategoryRef]
    source_url: str
    related: list[ProductSummary]
