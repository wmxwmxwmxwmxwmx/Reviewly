"""Per-user PR view state for inbox attention (DB-driven unread).

Revision ID: 014
Revises: 013
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import table_exists

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, "pull_request_user_views"):
        return
    op.create_table(
        "pull_request_user_views",
        sa.Column("user_id", sa.String(64), sa.ForeignKey("auth_users.id"), primary_key=True),
        sa.Column(
            "pr_id",
            sa.String(64),
            sa.ForeignKey("pull_requests.id"),
            primary_key=True,
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_head_sha", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_pull_request_user_views_user_id",
        "pull_request_user_views",
        ["user_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, "pull_request_user_views"):
        return
    op.drop_index("ix_pull_request_user_views_user_id", table_name="pull_request_user_views")
    op.drop_table("pull_request_user_views")
