"""B2 extensions: payload JSON, diffs, users, domain tables

Revision ID: 002
Revises: 001
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("repositories", sa.Column("payload", sa.JSON(), nullable=True))
    op.add_column("pull_requests", sa.Column("payload", sa.JSON(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("result_summary", sa.JSON(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("error_message", sa.String(1024), nullable=True))
    op.add_column("analysis_jobs", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))

    op.create_table(
        "pull_request_diffs",
        sa.Column("pull_request_id", sa.String(64), sa.ForeignKey("pull_requests.id"), primary_key=True),
        sa.Column("files", sa.JSON(), nullable=False),
        sa.Column("patch", sa.Text(), nullable=True),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("team_id", sa.String(64), sa.ForeignKey("teams.id")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
    )

    op.create_table(
        "governance_rules",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("rule", sa.String(1024), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true()),
        sa.Column("payload", sa.JSON(), nullable=True),
    )

    op.create_table(
        "governance_violations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("rule_id", sa.String(64), sa.ForeignKey("governance_rules.id")),
        sa.Column("pull_request_id", sa.String(64), sa.ForeignKey("pull_requests.id"), nullable=True),
        sa.Column("file", sa.String(512), nullable=True),
        sa.Column("violated", sa.Boolean(), server_default=sa.true()),
        sa.Column("payload", sa.JSON(), nullable=True),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("actor_id", sa.String(64), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("governance_violations")
    op.drop_table("governance_rules")
    op.drop_table("users")
    op.drop_table("pull_request_diffs")
    op.drop_column("analysis_jobs", "created_at")
    op.drop_column("analysis_jobs", "error_message")
    op.drop_column("analysis_jobs", "result_summary")
    op.drop_column("pull_requests", "payload")
    op.drop_column("repositories", "payload")
