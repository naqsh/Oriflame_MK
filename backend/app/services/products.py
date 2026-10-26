"""Product listing and detail for the public API (OR-018)."""

from datetime import timedelta
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.core.config import ConfigProvider, get_config_provider
from backend.app.db.session import get_db
from backend.app.integrations.oriflame.fixtures import FIXTURE_SOURCE_NAME
from backend.app.models import Product
from backend.app.repositories.product_reads import (
    get_visible_product,
    list_visible_products,
    related_products,
    search_visible_products,
)
from backend.app.schemas.products import (
    CategoryRef,
    ImageOut,
    ProductDetail,
    ProductPage,
    ProductQuery,
    ProductSummary,
    SearchQuery,
)
from backend.app.services.availability import AvailabilityPolicy, availability_for


class ProductNotFoundError(LookupError):
    """No visible product has this slug."""


def _image(product: Product) -> ImageOut | None:
    if not product.images:
        return None
    first = product.images[0]  # ordered by position
    return ImageOut(url=first.url, alt_text=first.alt_text)


def _summary(product: Product, policy: AvailabilityPolicy) -> ProductSummary:
    return ProductSummary(
        slug=product.slug,
        name=product.name,
        price_pkr=product.price_pkr,
        currency="PKR",
        primary_image=_image(product),
        availability=availability_for(product, "list", policy),
        data_source=product.source,
        is_development_data=product.source == FIXTURE_SOURCE_NAME,
    )


class ProductService:
    def __init__(self, session: Session, policy: AvailabilityPolicy | None = None) -> None:
        self._session = session
        self._policy = policy or AvailabilityPolicy()

    def list(self, query: ProductQuery) -> ProductPage:
        result = list_visible_products(self._session, query)
        return ProductPage(
            items=[_summary(product, self._policy) for product in result.products],
            total=result.total,
            page=query.page,
            page_size=query.page_size,
        )

    def search(self, query: SearchQuery) -> ProductPage:
        result = search_visible_products(
            self._session, query.q, page=query.page, page_size=query.page_size
        )
        return ProductPage(
            items=[_summary(product, self._policy) for product in result.products],
            total=result.total,
            page=query.page,
            page_size=query.page_size,
        )

    def get(self, slug: str) -> ProductDetail:
        product = get_visible_product(self._session, slug)
        if product is None:
            raise ProductNotFoundError(slug)
        summary = _summary(product, self._policy)
        return ProductDetail(
            **summary.model_dump(exclude={"availability"}),
            availability=availability_for(product, "detail", self._policy),
            sku=product.sku,
            description=product.description,
            images=[ImageOut(url=i.url, alt_text=i.alt_text) for i in product.images],
            categories=[
                CategoryRef(slug=c.slug, name=c.name)
                for c in sorted(product.categories, key=lambda c: c.name.lower())
            ],
            source_url=product.source_url,
            last_synced_at=product.last_synced_at,
            related=[_summary(p, self._policy) for p in related_products(self._session, product)],
        )


def get_product_service(
    db: Annotated[Session, Depends(get_db)],
    config: Annotated[ConfigProvider, Depends(get_config_provider)],
) -> ProductService:
    hours = config.get_settings().availability_max_age_hours
    return ProductService(db, AvailabilityPolicy(max_age=timedelta(hours=hours)))
