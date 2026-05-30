"""pull_requests owner_user_id for multi-account isolation

Revision ID: 009
Revises: 008
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pull_requests",
        sa.Column("owner_user_id", sa.String(64), nullable=True),
    )
    op.create_foreign_key(
        "fk_pull_requests_owner_user_id",
        "pull_requests",
        "auth_users",
        ["owner_user_id"],
        ["id"],
    )
    op.create_index(
        "ix_pull_requests_owner_user_id",
        "pull_requests",
        ["owner_user_id"],
    )
    op.execute(
        """
        UPDATE pull_requests
        SET owner_user_id = repositories.owner_user_id
        FROM repositories
        WHERE pull_requests.repository_id = repositories.id
          AND repositories.owner_user_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_pull_requests_owner_user_id", table_name="pull_requests")
    op.drop_constraint("fk_pull_requests_owner_user_id", "pull_requests", type_="foreignkey")
    op.drop_column("pull_requests", "owner_user_id")
