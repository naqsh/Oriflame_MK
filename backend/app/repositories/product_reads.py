"""Read queries for the public product API (OR-018). Visible products only.

All filters are bound parameters. A category filter includes its descendants; the
recursive query uses UNION (not UNION ALL), so a cycle in source category data ends
the recursion instead of looping.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session, aliased, selectinload

from backend.app.models import Category, Product, product_categories
from backend.app.schemas.products import ProductQuery, ProductSort

RELATED_LIMIT = 4


@dataclass(frozen=True)
class ProductListResult:
    products: Sequence[Product]
    total: int


def _category_and_descendant_ids(slug: str) -> Select[int]:
    tree = select(Category.id).where(Category.slug == slug).cte("category_tree", recursive=True)
    child = aliased(Category)
    tree = tree.union(select(child.id).where(child.parent_id == tree.c.id))
    return select(tree.c.id)


def _in_categories(category_ids: Select[int]) -> ColumnElement[bool]:
    return Product.id.in_(
        select(product_categories.c.product_id).where(
            product_categories.c.category_id.in_(category_ids)
        )
    )


def _filters(query: ProductQuery) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = [Product.is_visible.is_(True)]
    if query.category is not None:
        conditions.append(_in_categories(_category_and_descendant_ids(query.category)))
    # A NULL price never matches a price filter.
    if query.min_price is not None:
        conditions.append(Product.price_pkr >= query.min_price)
    if query.max_price is not None:
        conditions.append(Product.price_pkr <= query.max_price)
    return conditions


def _order_by(sort: ProductSort) -> list[ColumnElement[Any]]:
    name = func.lower(Product.name)
    match sort:
        case "name_asc":
            return [name.asc(), Product.id.asc()]
        case "name_desc":
            return [name.desc(), Product.id.desc()]
        case "price_asc":  # unknown prices last in both directions
            return [Product.price_pkr.asc().nulls_last(), name.asc(), Product.id.asc()]
        case "price_desc":
            return [Product.price_pkr.desc().nulls_last(), name.asc(), Product.id.asc()]
        case "newest":
            return [Product.created_at.desc(), Product.id.desc()]


def list_visible_products(session: Session, query: ProductQuery) -> ProductListResult:
    conditions = _filters(query)
    total = session.scalar(select(func.count()).select_from(Product).where(*conditions)) or 0
    products = session.scalars(
        select(Product)
        .where(*conditions)
        .order_by(*_order_by(query.sort))
        .offset((query.page - 1) * query.page_size)
        .limit(query.page_size)
        .options(selectinload(Product.images))
    ).all()
    return ProductListResult(products=products, total=total)


def get_visible_product(session: Session, slug: str) -> Product | None:
    return session.scalars(
        select(Product)
        .where(Product.slug == slug, Product.is_visible.is_(True))
        .options(selectinload(Product.images), selectinload(Product.categories))
    ).one_or_none()


def related_products(
    session: Session, product: Product, limit: int = RELATED_LIMIT
) -> list[Product]:
    """Visible products sharing a category with ``product``, by name."""
    category_ids = [category.id for category in product.categories]
    if not category_ids:
        return []
    return list(
        session.scalars(
            select(Product)
            .where(
                Product.is_visible.is_(True),
                Product.id != product.id,
                _in_categories(select(Category.id).where(Category.id.in_(category_ids))),
            )
            .order_by(func.lower(Product.name), Product.id)
            .limit(limit)
            .options(selectinload(Product.images))
        )
    )
