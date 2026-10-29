"""Admin product reads and owner-flag writes (OR-048). Includes hidden and unlisted rows."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.app.models import Product


def _like_pattern(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def page(
    session: Session, *, q: str | None, page: int, page_size: int
) -> tuple[list[Product], int]:
    """Products by name, optionally matching ``q`` in name, SKU or slug."""
    statement = select(Product)
    text = (q or "").strip()
    if text:
        pattern = _like_pattern(text)
        statement = statement.where(
            or_(
                Product.name.ilike(pattern, escape="\\"),
                Product.sku.ilike(pattern, escape="\\"),
                Product.slug.ilike(pattern, escape="\\"),
            )
        )
    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    rows = session.scalars(
        statement.order_by(Product.name, Product.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return list(rows), total


def for_update(session: Session, slug: str) -> Product | None:
    """The product row, locked until the caller commits, so concurrent edits serialise."""
    return session.scalar(select(Product).where(Product.slug == slug).with_for_update())
