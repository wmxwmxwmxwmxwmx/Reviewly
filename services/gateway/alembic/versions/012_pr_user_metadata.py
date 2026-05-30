"""PR user metadata: display_name, note, favorite

Revision ID: 012
Revises: 011
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import column_exists

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    favorite_default = sa.text("false") if dialect == "postgresql" else sa.text("0")

    if not column_exists(bind, "pull_requests", "display_name"):
        op.add_column("pull_requests", sa.Column("display_name", sa.String(256), nullable=True))
    if not column_exists(bind, "pull_requests", "note"):
        op.add_column("pull_requests", sa.Column("note", sa.Text(), nullable=True))
    if not column_exists(bind, "pull_requests", "favorite"):
        op.add_column(
            "pull_requests",
            sa.Column("favorite", sa.Boolean(), nullable=False, server_default=favorite_default),
        )


def downgrade() -> None:
    bind = op.get_bind()
    for col in ("favorite", "note", "display_name"):
        if column_exists(bind, "pull_requests", col):
            op.drop_column("pull_requests", col)
