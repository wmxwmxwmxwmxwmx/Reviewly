"""P0 reality fix: user_dismissed_repositories + ai_usage_logs

Revision ID: 012
Revises: 011
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import index_exists, table_exists

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    if not table_exists(bind, "user_dismissed_repositories"):
        op.create_table(
            "user_dismissed_repositories",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("user_id", sa.String(64), sa.ForeignKey("auth_users.id"), nullable=False),
            sa.Column("github_id", sa.String(64), nullable=True),
            sa.Column("full_name", sa.String(512), nullable=True),
            sa.Column(
                "dismissed_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
        )
    if not index_exists(bind, "user_dismissed_repositories", "ix_user_dismissed_user_github"):
        op.create_index(
            "ix_user_dismissed_user_github",
            "user_dismissed_repositories",
            ["user_id", "github_id"],
            unique=False,
        )
    if not index_exists(bind, "user_dismissed_repositories", "ix_user_dismissed_user_fullname"):
        op.create_index(
            "ix_user_dismissed_user_fullname",
            "user_dismissed_repositories",
            ["user_id", "full_name"],
            unique=False,
        )

    if not table_exists(bind, "ai_usage_logs"):
        op.create_table(
            "ai_usage_logs",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.Column("user_id", sa.String(64), sa.ForeignKey("auth_users.id"), nullable=True),
            sa.Column("team_id", sa.String(64), sa.ForeignKey("teams.id"), nullable=True),
            sa.Column("feature", sa.String(64), nullable=False),
            sa.Column("provider", sa.String(32), nullable=False),
            sa.Column("model", sa.String(128), nullable=False),
            sa.Column("stream", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("pull_request_id", sa.String(64), sa.ForeignKey("pull_requests.id"), nullable=True),
            sa.Column("repository_id", sa.String(64), sa.ForeignKey("repositories.id"), nullable=True),
            sa.Column("finding_id", sa.String(64), nullable=True),
            sa.Column("job_id", sa.String(64), sa.ForeignKey("analysis_jobs.id"), nullable=True),
            sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(16), nullable=False, server_default="ok"),
            sa.Column("error_message", sa.String(512), nullable=True),
            sa.Column("cost_cny_estimate", sa.Numeric(12, 6), nullable=True),
            sa.Column("request_id", sa.String(64), nullable=True),
        )
    if not index_exists(bind, "ai_usage_logs", "ix_ai_usage_logs_created_at"):
        op.create_index("ix_ai_usage_logs_created_at", "ai_usage_logs", ["created_at"], unique=False)
    if not index_exists(bind, "ai_usage_logs", "ix_ai_usage_logs_user_created"):
        op.create_index(
            "ix_ai_usage_logs_user_created",
            "ai_usage_logs",
            ["user_id", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, "ai_usage_logs"):
        op.drop_table("ai_usage_logs")
    if table_exists(bind, "user_dismissed_repositories"):
        op.drop_table("user_dismissed_repositories")
