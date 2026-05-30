"""pull_requests owner_user_id for multi-account isolation

Revision ID: 009
Revises: 008
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import column_exists, fk_exists, index_exists

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if not column_exists(bind, "pull_requests", "owner_user_id"):
        op.add_column(
            "pull_requests",
            sa.Column("owner_user_id", sa.String(64), nullable=True),
        )

    if dialect == "sqlite":
        with op.batch_alter_table("pull_requests") as batch_op:
            if not fk_exists(bind, "fk_pull_requests_owner_user_id"):
                batch_op.create_foreign_key(
                    "fk_pull_requests_owner_user_id",
                    "auth_users",
                    ["owner_user_id"],
                    ["id"],
                )
            if not index_exists(bind, "pull_requests", "ix_pull_requests_owner_user_id"):
                batch_op.create_index(
                    "ix_pull_requests_owner_user_id",
                    ["owner_user_id"],
                )
    else:
        if not fk_exists(bind, "fk_pull_requests_owner_user_id"):
            op.create_foreign_key(
                "fk_pull_requests_owner_user_id",
                "pull_requests",
                "auth_users",
                ["owner_user_id"],
                ["id"],
            )
        if not index_exists(bind, "pull_requests", "ix_pull_requests_owner_user_id"):
            op.create_index(
                "ix_pull_requests_owner_user_id",
                "pull_requests",
                ["owner_user_id"],
            )

    if dialect == "postgresql":
        op.execute(
            """
            UPDATE pull_requests
            SET owner_user_id = repositories.owner_user_id
            FROM repositories
            WHERE pull_requests.repository_id = repositories.id
              AND repositories.owner_user_id IS NOT NULL
              AND pull_requests.owner_user_id IS NULL
            """
        )
    else:
        op.execute(
            """
            UPDATE pull_requests
            SET owner_user_id = (
                SELECT repositories.owner_user_id
                FROM repositories
                WHERE repositories.id = pull_requests.repository_id
                  AND repositories.owner_user_id IS NOT NULL
            )
            WHERE pull_requests.owner_user_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM repositories
                WHERE repositories.id = pull_requests.repository_id
                  AND repositories.owner_user_id IS NOT NULL
              )
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if index_exists(bind, "pull_requests", "ix_pull_requests_owner_user_id"):
        op.drop_index("ix_pull_requests_owner_user_id", table_name="pull_requests")
    if fk_exists(bind, "fk_pull_requests_owner_user_id"):
        op.drop_constraint("fk_pull_requests_owner_user_id", "pull_requests", type_="foreignkey")
    if column_exists(bind, "pull_requests", "owner_user_id"):
        op.drop_column("pull_requests", "owner_user_id")
