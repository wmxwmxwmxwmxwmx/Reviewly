"""Repository source_type for connected vs external isolation

Revision ID: 008
Revises: 007
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import column_exists

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if not column_exists(bind, "repositories", "source_type"):
        op.add_column(
            "repositories",
            sa.Column("source_type", sa.String(32), nullable=False, server_default="github"),
        )
        if dialect != "sqlite":
            op.alter_column("repositories", "source_type", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    if column_exists(bind, "repositories", "source_type"):
        op.drop_column("repositories", "source_type")
