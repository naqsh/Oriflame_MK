"""Category tree and detail for the public API (OR-019).

Cyclic parent links from a source (A -> B -> A) are broken deterministically: within
each cycle the category with the lowest id is treated as top-level, and the cycle is
logged. The stored data is not changed.
"""

from dataclasses import dataclass
from typing import Annotated

import structlog
from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.repositories.category_reads import (
    CategoryRow,
    all_categories,
    visible_product_ids_by_category,
)
from backend.app.schemas.categories import (
    CategoryDetail,
    CategoryNode,
    CategorySummary,
    CategoryTree,
)
from backend.app.schemas.products import CategoryRef

logger = structlog.get_logger(__name__)


class CategoryNotFoundError(LookupError):
    """No category has this slug."""


def break_cycles(parents: dict[int, int | None]) -> dict[int, int | None]:
    """Parent map with every cycle cut at its lowest-id member. Returns a new map."""
    fixed = dict(parents)
    for start in sorted(fixed):
        path: list[int] = []
        seen: set[int] = set()
        node: int | None = start
        while node is not None and node not in seen:
            seen.add(node)
            path.append(node)
            node = fixed.get(node)
        if node is not None:  # walked back into the path: a cycle
            cycle = path[path.index(node) :]
            cut = min(cycle)
            fixed[cut] = None
            logger.warning("category_cycle_detected", category_ids=sorted(cycle), cut_at=cut)
    return fixed


@dataclass
class _Tree:
    rows: dict[int, CategoryRow]
    parents: dict[int, int | None]
    children: dict[int | None, list[int]]
    counts: dict[int, int]


def _build(session: Session) -> _Tree:
    rows = {row.id: row for row in all_categories(session)}
    parents = break_cycles({row.id: row.parent_id for row in rows.values()})
    children: dict[int | None, list[int]] = {}
    for category_id in rows:
        children.setdefault(parents[category_id], []).append(category_id)
    for siblings in children.values():
        siblings.sort(key=lambda cid: (rows[cid].name.lower(), cid))

    direct = visible_product_ids_by_category(session)
    subtree: dict[int, set[int]] = {}

    def collect(category_id: int) -> set[int]:
        products = set(direct.get(category_id, set()))
        for child in children.get(category_id, []):
            products |= collect(child)
        subtree[category_id] = products
        return products

    for root in children.get(None, []):
        collect(root)
    counts = {category_id: len(products) for category_id, products in subtree.items()}
    return _Tree(rows, parents, children, counts)


class CategoryService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def tree(self) -> CategoryTree:
        tree = _build(self._session)

        def node(category_id: int) -> CategoryNode:
            row = tree.rows[category_id]
            return CategoryNode(
                slug=row.slug,
                name=row.name,
                product_count=tree.counts[category_id],
                children=[node(child) for child in tree.children.get(category_id, [])],
            )

        return CategoryTree(items=[node(root) for root in tree.children.get(None, [])])

    def get(self, slug: str) -> CategoryDetail:
        tree = _build(self._session)
        match = next((row for row in tree.rows.values() if row.slug == slug), None)
        if match is None:
            raise CategoryNotFoundError(slug)

        ancestors: list[CategoryRef] = []
        parent = tree.parents[match.id]
        while parent is not None:
            ancestors.append(CategoryRef(slug=tree.rows[parent].slug, name=tree.rows[parent].name))
            parent = tree.parents[parent]
        ancestors.reverse()

        return CategoryDetail(
            slug=match.slug,
            name=match.name,
            product_count=tree.counts[match.id],
            ancestors=ancestors,
            children=[
                CategorySummary(
                    slug=tree.rows[child].slug,
                    name=tree.rows[child].name,
                    product_count=tree.counts[child],
                )
                for child in tree.children.get(match.id, [])
            ],
        )


def get_category_service(db: Annotated[Session, Depends(get_db)]) -> CategoryService:
    return CategoryService(db)
