"""Referral clicks for basic analytics, without personal data (OR-031).

Revision ID: 005_referral_clicks
Revises: 004_product_search
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005_referral_clicks"
down_revision: str | None = "004_product_search"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "referral_clicks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("method", sa.String(length=20), nullable=False),
        sa.Column("origin", sa.String(length=20), nullable=False),
        sa.Column("product_slug", sa.String(length=200), nullable=True),
        sa.Column("item_count", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint(
            "method IN ('official_url', 'manual_code', 'unavailable')",
            name=op.f("ck_referral_clicks_method_known"),
        ),
        sa.CheckConstraint(
            "origin IN ('pdp', 'list', 'referral_page')",
            name=op.f("ck_referral_clicks_origin_known"),
        ),
        sa.CheckConstraint(
            "item_count BETWEEN 0 AND 200", name=op.f("ck_referral_clicks_item_count_range")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_referral_clicks")),
    )
    op.create_index(
        op.f("ix_referral_clicks_occurred_at"), "referral_clicks", ["occurred_at"], unique=False
    )
    op.execute("ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index(op.f("ix_referral_clicks_occurred_at"), table_name="referral_clicks")
    op.drop_table("referral_clicks")
