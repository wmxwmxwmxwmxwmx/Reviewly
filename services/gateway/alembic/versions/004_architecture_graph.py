"""Repository architecture graph cache

Revision ID: 004
Revises: 003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("repositories", sa.Column("architecture_graph", sa.JSON(), nullable=True))
    op.add_column(
        "repositories",
        sa.Column("architecture_scanned_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("repositories", "architecture_scanned_at")
    op.drop_column("repositories", "architecture_graph")
