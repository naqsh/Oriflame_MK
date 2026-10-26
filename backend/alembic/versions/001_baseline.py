"""Baseline: empty schema. Catalogue tables arrive in OR-E2; no tenant tables.

Also locks alembic_version (it lives in public) away from Supabase's Data API:
RLS enabled with no policies, like every application table.

Revision ID: 001_baseline
Revises:
Create Date: 2026-10-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "001_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.execute("ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY")
