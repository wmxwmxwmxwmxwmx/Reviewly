"""Repository GitHub metadata columns

Revision ID: 005
Revises: 004
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("repositories", sa.Column("github_id", sa.String(32), nullable=True))
    op.add_column("repositories", sa.Column("owner", sa.String(255), nullable=True))
    op.add_column("repositories", sa.Column("name", sa.String(255), nullable=True))
    op.add_column("repositories", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("repositories", sa.Column("language", sa.String(64), nullable=True))
    op.add_column("repositories", sa.Column("stars", sa.Integer(), nullable=True))
    op.add_column("repositories", sa.Column("forks", sa.Integer(), nullable=True))
    op.add_column("repositories", sa.Column("open_prs", sa.Integer(), nullable=True))
    op.add_column("repositories", sa.Column("default_branch", sa.String(255), nullable=True))
    op.add_column("repositories", sa.Column("clone_url", sa.String(512), nullable=True))
    op.add_column("repositories", sa.Column("html_url", sa.String(512), nullable=True))
    op.add_column("repositories", sa.Column("avatar_url", sa.String(512), nullable=True))
    op.add_column("repositories", sa.Column("is_private", sa.Boolean(), nullable=True))
    op.add_column(
        "repositories",
        sa.Column("github_created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "repositories",
        sa.Column("github_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("repositories", sa.Column("pushed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "repositories",
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "repositories",
        sa.Column("webhook_installed", sa.Boolean(), server_default=sa.false(), nullable=True),
    )

    op.create_index("ix_repositories_github_id", "repositories", ["github_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_repositories_github_id", table_name="repositories")
    op.drop_column("repositories", "webhook_installed")
    op.drop_column("repositories", "last_synced_at")
    op.drop_column("repositories", "pushed_at")
    op.drop_column("repositories", "github_updated_at")
    op.drop_column("repositories", "github_created_at")
    op.drop_column("repositories", "is_private")
    op.drop_column("repositories", "avatar_url")
    op.drop_column("repositories", "html_url")
    op.drop_column("repositories", "clone_url")
    op.drop_column("repositories", "default_branch")
    op.drop_column("repositories", "open_prs")
    op.drop_column("repositories", "forks")
    op.drop_column("repositories", "stars")
    op.drop_column("repositories", "language")
    op.drop_column("repositories", "description")
    op.drop_column("repositories", "name")
    op.drop_column("repositories", "owner")
    op.drop_column("repositories", "github_id")
