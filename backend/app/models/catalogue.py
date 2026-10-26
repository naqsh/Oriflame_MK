"""Catalogue schema (OR-011). Single vendor: no tenant columns or tables.

Variants and availability are not modelled: ADR-001 confirms no source that provides
them, so the storefront labels availability "not confirmed". Ratings and reviews are
never stored.
"""

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base

SLUG_MAX_LENGTH = 200

product_categories = Table(
    "product_categories",
    Base.metadata,
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_product_categories_category_id", "category_id"),
)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        # A missing price is NULL, never 0 or a guess.
        CheckConstraint("price_pkr > 0", name="price_pkr_positive"),
        CheckConstraint("currency = 'PKR'", name="currency_pkr"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[str] = mapped_column(String(100), unique=True)
    sku: Mapped[str | None] = mapped_column(String(100), index=True)
    slug: Mapped[str] = mapped_column(String(SLUG_MAX_LENGTH), unique=True)
    name: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    price_pkr: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="PKR", server_default="PKR")
    source_url: Mapped[str] = mapped_column(String(2048))
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_visible: Mapped[bool] = mapped_column(default=True, server_default="true")
    is_featured: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ProductImage.position",
    )
    categories: Mapped[list["Category"]] = relationship(
        secondary=product_categories, back_populates="products", passive_deletes=True
    )


# Case-insensitive name lookups; full-text search arrives in OR-E3.
Index("ix_products_name_lower", func.lower(Product.name))


class ProductImage(Base):
    """Authorised image assets only. Empty while ADR-001 is Proposed (images omitted)."""

    __tablename__ = "product_images"
    __table_args__ = (
        UniqueConstraint("product_id", "position", name="uq_product_images_product_id_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(2048))
    alt_text: Mapped[str] = mapped_column(String(300))
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    source_url: Mapped[str] = mapped_column(String(2048))

    product: Mapped[Product] = relationship(back_populates="images")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(SLUG_MAX_LENGTH), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )

    parent: Mapped["Category | None"] = relationship(remote_side=[id])
    products: Mapped[list[Product]] = relationship(
        secondary=product_categories, back_populates="categories", passive_deletes=True
    )


class SyncRunStatus(enum.StrEnum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class CatalogueSyncRun(Base):
    __tablename__ = "catalogue_sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(100))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[SyncRunStatus] = mapped_column(
        Enum(
            SyncRunStatus,
            name="sync_run_status",
            values_callable=lambda members: [member.value for member in members],
        ),
        default=SyncRunStatus.RUNNING,
        server_default=SyncRunStatus.RUNNING.value,
    )
    created_count: Mapped[int] = mapped_column(default=0, server_default="0")
    updated_count: Mapped[int] = mapped_column(default=0, server_default="0")
    unchanged_count: Mapped[int] = mapped_column(default=0, server_default="0")
    error_count: Mapped[int] = mapped_column(default=0, server_default="0")
    error_detail: Mapped[str | None] = mapped_column(Text)
