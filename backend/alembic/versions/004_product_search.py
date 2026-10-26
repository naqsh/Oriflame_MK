"""Product search: generated tsvector with GIN index, pg_trgm name index (OR-020).

pg_trgm is created in the "extensions" schema, the Supabase convention; the schema is
created first when missing (plain PostgreSQL). Downgrade drops the column and indexes
but keeps the extension and schema, which other objects may use.

Revision ID: 004_product_search
Revises: 003_product_source
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_product_search"
down_revision: str | None = "003_product_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SEARCH_VECTOR_SQL = (
    "setweight(to_tsvector('english', coalesce(name, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce(description, '')), 'B')"
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS extensions")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions")
    op.add_column(
        "products",
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(SEARCH_VECTOR_SQL, persisted=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_products_search_vector",
        "products",
        ["search_vector"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_products_name_trgm",
        "products",
        ["name"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"name": "extensions.gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_products_name_trgm", table_name="products", postgresql_using="gin")
    op.drop_index("ix_products_search_vector", table_name="products", postgresql_using="gin")
    op.drop_column("products", "search_vector")
