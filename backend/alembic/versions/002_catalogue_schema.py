"""Catalogue schema: products, images, categories, sync runs (OR-011).

No tenant tables. No variant or availability tables: ADR-001 confirms no source that
provides them. Every table gets RLS with no policies (Supabase Data API lockdown).

Downgrade drops these tables and the sync_run_status enum type, so all catalogue data
is lost; it is for development only.

Revision ID: 002_catalogue_schema
Revises: 001_baseline
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "002_catalogue_schema"
down_revision: str | None = "001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = (
    "catalogue_sync_runs",
    "categories",
    "products",
    "product_categories",
    "product_images",
)

sync_run_status = sa.Enum("running", "success", "failed", "partial", name="sync_run_status")


def upgrade() -> None:
    op.create_table(
        "catalogue_sync_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sync_run_status, server_default="running", nullable=False),
        sa.Column("created_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("unchanged_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalogue_sync_runs")),
    )
    op.create_index(
        op.f("ix_catalogue_sync_runs_started_at"),
        "catalogue_sync_runs",
        ["started_at"],
        unique=False,
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["categories.id"],
            name=op.f("fk_categories_parent_id_categories"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("slug", name=op.f("uq_categories_slug")),
        sa.UniqueConstraint("source_id", name=op.f("uq_categories_source_id")),
    )
    op.create_index(op.f("ix_categories_parent_id"), "categories", ["parent_id"], unique=False)

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.String(length=100), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_pkr", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="PKR", nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_visible", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_featured", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("currency = 'PKR'", name=op.f("ck_products_currency_pkr")),
        sa.CheckConstraint("price_pkr > 0", name=op.f("ck_products_price_pkr_positive")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
        sa.UniqueConstraint("slug", name=op.f("uq_products_slug")),
        sa.UniqueConstraint("source_id", name=op.f("uq_products_source_id")),
    )
    op.create_index(
        "ix_products_name_lower", "products", [sa.literal_column("lower(name)")], unique=False
    )
    op.create_index(op.f("ix_products_sku"), "products", ["sku"], unique=False)

    op.create_table(
        "product_categories",
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_product_categories_category_id_categories"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("fk_product_categories_product_id_products"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("product_id", "category_id", name=op.f("pk_product_categories")),
    )
    op.create_index(
        "ix_product_categories_category_id", "product_categories", ["category_id"], unique=False
    )

    op.create_table(
        "product_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("alt_text", sa.String(length=300), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("fk_product_images_product_id_products"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_images")),
        sa.UniqueConstraint(
            "product_id", "position", name=op.f("uq_product_images_product_id_position")
        ),
    )

    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("product_images")
    op.drop_index("ix_product_categories_category_id", table_name="product_categories")
    op.drop_table("product_categories")
    op.drop_index(op.f("ix_products_sku"), table_name="products")
    op.drop_index("ix_products_name_lower", table_name="products")
    op.drop_table("products")
    op.drop_index(op.f("ix_categories_parent_id"), table_name="categories")
    op.drop_table("categories")
    op.drop_index(op.f("ix_catalogue_sync_runs_started_at"), table_name="catalogue_sync_runs")
    op.drop_table("catalogue_sync_runs")
    sync_run_status.drop(op.get_bind(), checkfirst=False)
