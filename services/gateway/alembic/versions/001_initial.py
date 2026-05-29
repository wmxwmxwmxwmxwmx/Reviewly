"""initial schema

Revision ID: 001
Revises:
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
    )
    op.create_table(
        "repositories",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("team_id", sa.String(64), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("installation_id", sa.String(64), nullable=True),
        sa.Column("full_name", sa.String(512), nullable=False),
        sa.Column("ai_review_enabled", sa.Boolean(), server_default=sa.true()),
        sa.Column("settings", postgresql.JSON(), nullable=True),
    )
    op.create_table(
        "pull_requests",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("repository_id", sa.String(64), sa.ForeignKey("repositories.id")),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("github_id", sa.String(64), unique=True),
        sa.Column("state", sa.String(32)),
        sa.Column("risk_score", sa.Integer(), server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "analysis_jobs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("pull_request_id", sa.String(64), sa.ForeignKey("pull_requests.id")),
        sa.Column("status", sa.String(32)),
        sa.Column("progress", sa.Integer(), server_default="0"),
        sa.Column("chunk_index", sa.Integer(), server_default="0"),
        sa.Column("chunk_total", sa.Integer(), server_default="0"),
        sa.Column("usage", postgresql.JSON(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "analysis_findings",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("job_id", sa.String(64), sa.ForeignKey("analysis_jobs.id")),
        sa.Column("type", sa.String(32)),
        sa.Column("severity", sa.String(16)),
        sa.Column("title", sa.String(512)),
        sa.Column("file", sa.String(512)),
        sa.Column("line", sa.Integer()),
        sa.Column("payload", postgresql.JSON(), nullable=True),
    )
    op.create_table(
        "settings",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("data", postgresql.JSON(), nullable=False),
        sa.Column("encrypted_secrets", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("settings")
    op.drop_table("analysis_findings")
    op.drop_table("analysis_jobs")
    op.drop_table("pull_requests")
    op.drop_table("repositories")
    op.drop_table("teams")
