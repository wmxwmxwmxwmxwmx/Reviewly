"""Per-file PR diff storage for analysis pipeline

Revision ID: 007
Revises: 006
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pull_request_files",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "pull_request_id",
            sa.String(64),
            sa.ForeignKey("pull_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(1024), nullable=False),
        sa.Column("patch", sa.Text(), nullable=True),
        sa.Column("additions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("deletions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="modified"),
    )
    op.create_index(
        "ix_pull_request_files_pull_request_id",
        "pull_request_files",
        ["pull_request_id"],
    )
    op.create_index(
        "uq_pull_request_files_pr_filename",
        "pull_request_files",
        ["pull_request_id", "filename"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_pull_request_files_pr_filename", table_name="pull_request_files")
    op.drop_index("ix_pull_request_files_pull_request_id", table_name="pull_request_files")
    op.drop_table("pull_request_files")
