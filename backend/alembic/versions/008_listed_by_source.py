"""Split source listing from owner visibility (OR-048).

Until now ``is_visible`` was written only by the sync, which hid products the source no
longer lists. From here on ``is_visible`` and ``is_featured`` belong to the owner, and
the sync writes ``listed_by_source`` instead. Existing hidden products were hidden by
the sync, so they move to ``listed_by_source = false`` with ``is_visible`` restored.

Revision ID: 008_listed_by_source
Revises: 007_audit_logs
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "008_listed_by_source"
down_revision: str | None = "007_audit_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("listed_by_source", sa.Boolean(), server_default="true", nullable=False),
    )
    op.execute(
        "UPDATE products SET listed_by_source = false, is_visible = true WHERE is_visible = false"
    )


def downgrade() -> None:
    # Back to one flag: a product is visible only if both allowed it.
    op.execute("UPDATE products SET is_visible = false WHERE listed_by_source = false")
    op.drop_column("products", "listed_by_source")
