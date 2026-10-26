"""Read queries for the public category API (OR-019).

The catalogue has a small number of categories, so the service builds the tree in
memory from two queries instead of recursive SQL.
"""

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Category, Product, product_categories


@dataclass(frozen=True)
class CategoryRow:
    id: int
    slug: str
    name: str
    parent_id: int | None


def all_categories(session: Session) -> list[CategoryRow]:
    rows = session.execute(
        select(Category.id, Category.slug, Category.name, Category.parent_id).order_by(Category.id)
    )
    return [CategoryRow(*row) for row in rows]


def visible_product_ids_by_category(session: Session) -> dict[int, set[int]]:
    """Category id -> ids of visible products linked directly to it."""
    rows = session.execute(
        select(product_categories.c.category_id, product_categories.c.product_id)
        .join(Product, Product.id == product_categories.c.product_id)
        .where(Product.is_visible.is_(True))
    )
    members: dict[int, set[int]] = defaultdict(set)
    for category_id, product_id in rows:
        members[category_id].add(product_id)
    return members
