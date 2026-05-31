"""Auth users, team memberships, repository ownership scope

Revision ID: 006
Revises: 005
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.create_table(
        "auth_users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("github_id", sa.String(32), nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(512), nullable=True),
        sa.Column("access_token_encrypted", sa.Text(), nullable=True),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_auth_users_github_id", "auth_users", ["github_id"], unique=True)

    op.create_table(
        "team_memberships",
        sa.Column("user_id", sa.String(64), sa.ForeignKey("auth_users.id"), primary_key=True),
        sa.Column("team_id", sa.String(64), sa.ForeignKey("teams.id"), primary_key=True),
        sa.Column("role", sa.String(32), nullable=False, server_default="member"),
    )

    if dialect == "sqlite":
        with op.batch_alter_table("repositories") as batch_op:
            batch_op.add_column(sa.Column("owner_user_id", sa.String(64), nullable=True))
            batch_op.add_column(
                sa.Column("visibility", sa.String(32), nullable=True, server_default="private"),
            )
            batch_op.add_column(sa.Column("source", sa.String(32), nullable=True))
            batch_op.create_foreign_key(
                "fk_repositories_owner_user_id",
                "auth_users",
                ["owner_user_id"],
                ["id"],
            )
    else:
        op.add_column("repositories", sa.Column("owner_user_id", sa.String(64), nullable=True))
        op.add_column(
            "repositories",
            sa.Column("visibility", sa.String(32), nullable=True, server_default="private"),
        )
        op.add_column("repositories", sa.Column("source", sa.String(32), nullable=True))
        op.create_foreign_key(
            "fk_repositories_owner_user_id",
            "repositories",
            "auth_users",
            ["owner_user_id"],
            ["id"],
        )
    op.create_index("ix_repositories_owner_user_id", "repositories", ["owner_user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.drop_index("ix_repositories_owner_user_id", table_name="repositories")
    if dialect == "sqlite":
        with op.batch_alter_table("repositories") as batch_op:
            batch_op.drop_constraint("fk_repositories_owner_user_id", type_="foreignkey")
            batch_op.drop_column("source")
            batch_op.drop_column("visibility")
            batch_op.drop_column("owner_user_id")
    else:
        op.drop_constraint("fk_repositories_owner_user_id", "repositories", type_="foreignkey")
        op.drop_column("repositories", "source")
        op.drop_column("repositories", "visibility")
        op.drop_column("repositories", "owner_user_id")
    op.drop_table("team_memberships")
    op.drop_index("ix_auth_users_github_id", table_name="auth_users")
    op.drop_table("auth_users")
