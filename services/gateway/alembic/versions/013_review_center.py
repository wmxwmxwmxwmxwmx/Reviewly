"""Review center: review_status, review_comments, review_timeline_events

Revision ID: 013
Revises: 012
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import column_exists, table_exists

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REVIEW_STATUSES = ("OPEN", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "MERGED", "CLOSED")
COMMENT_TYPES = ("COMMENT", "APPROVE", "REQUEST_CHANGES")
TIMELINE_ACTORS = ("user", "ai", "system")


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if not column_exists(bind, "pull_requests", "review_status"):
        op.add_column(
            "pull_requests",
            sa.Column(
                "review_status",
                sa.String(32),
                nullable=False,
                server_default="OPEN",
            ),
        )
        op.create_index("ix_pull_requests_review_status", "pull_requests", ["review_status"])

    if dialect == "postgresql":
        op.execute(
            """
            UPDATE pull_requests SET review_status = 'MERGED'
            WHERE state = 'merged' AND review_status = 'OPEN'
            """
        )
        op.execute(
            """
            UPDATE pull_requests SET review_status = 'CLOSED'
            WHERE state = 'closed' AND review_status = 'OPEN'
            """
        )

    if not table_exists(bind, "review_comments"):
        op.create_table(
            "review_comments",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column(
                "pull_request_id",
                sa.String(64),
                sa.ForeignKey("pull_requests.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "user_id",
                sa.String(64),
                sa.ForeignKey("auth_users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("user_name", sa.String(255), nullable=False, server_default=""),
            sa.Column("comment_type", sa.String(32), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
        )

    if not table_exists(bind, "review_timeline_events"):
        op.create_table(
            "review_timeline_events",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column(
                "pull_request_id",
                sa.String(64),
                sa.ForeignKey("pull_requests.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("event_type", sa.String(64), nullable=False),
            sa.Column("actor", sa.String(255), nullable=False),
            sa.Column("actor_type", sa.String(16), nullable=False, server_default="system"),
            sa.Column("content", sa.Text(), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, "review_timeline_events"):
        op.drop_table("review_timeline_events")
    if table_exists(bind, "review_comments"):
        op.drop_table("review_comments")
    if column_exists(bind, "pull_requests", "review_status"):
        op.drop_index("ix_pull_requests_review_status", table_name="pull_requests")
        op.drop_column("pull_requests", "review_status")
