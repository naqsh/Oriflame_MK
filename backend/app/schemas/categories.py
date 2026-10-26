"""Public category API models (OR-019).

``product_count`` counts distinct visible products in the category and all of its
subcategories, matching ``GET /api/v1/products?category=slug``.
"""

from pydantic import BaseModel

from backend.app.schemas.products import CategoryRef


class CategoryNode(BaseModel):
    slug: str
    name: str
    product_count: int
    children: list["CategoryNode"]


class CategoryTree(BaseModel):
    items: list[CategoryNode]


class CategorySummary(BaseModel):
    slug: str
    name: str
    product_count: int


class CategoryDetail(CategorySummary):
    # Root first, ending with the direct parent; empty for a top-level category.
    ancestors: list[CategoryRef]
    children: list[CategorySummary]
