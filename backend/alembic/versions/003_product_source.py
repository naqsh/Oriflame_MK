"""Product source name, so development fixtures are distinguishable (OR-015).

Before this revision only the development fixture source could have written products
(ADR-001), so existing rows are backfilled as ``dev_fixture``.

Revision ID: 003_product_source
Revises: 002_catalogue_schema
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "003_product_source"
down_revision: str | None = "002_catalogue_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("source", sa.String(length=50), nullable=True))
    op.execute("UPDATE products SET source = 'dev_fixture' WHERE source IS NULL")
    op.alter_column("products", "source", nullable=False)
    op.create_index(op.f("ix_products_source"), "products", ["source"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_source"), table_name="products")
    op.drop_column("products", "source")
