"""PR analysis cache: head_sha, analysis_version, job phases, cache events

Revision ID: 011
Revises: 010
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import column_exists, index_exists, table_exists

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    cache_hit_default = sa.text("false") if dialect == "postgresql" else sa.text("0")

    if not column_exists(bind, "pull_requests", "head_sha"):
        op.add_column("pull_requests", sa.Column("head_sha", sa.String(64), nullable=True))
    if not column_exists(bind, "pull_requests", "base_sha"):
        op.add_column("pull_requests", sa.Column("base_sha", sa.String(64), nullable=True))
    if not column_exists(bind, "pull_requests", "analysis_version"):
        op.add_column("pull_requests", sa.Column("analysis_version", sa.String(128), nullable=True))

    if not index_exists(bind, "pull_requests", "ix_pull_requests_repo_number_head"):
        op.create_index(
            "ix_pull_requests_repo_number_head",
            "pull_requests",
            ["repository_id", "number", "head_sha"],
            unique=False,
        )

    job_cols = [
        ("analysis_version", sa.String(128)),
        ("head_sha", sa.String(64)),
        ("base_sha", sa.String(64)),
        ("phase", sa.String(32)),
        ("source_job_id", sa.String(64)),
    ]
    for name, col_type in job_cols:
        if not column_exists(bind, "analysis_jobs", name):
            op.add_column("analysis_jobs", sa.Column(name, col_type, nullable=True))

    if not column_exists(bind, "analysis_jobs", "cache_hit"):
        op.add_column(
            "analysis_jobs",
            sa.Column("cache_hit", sa.Boolean(), nullable=False, server_default=cache_hit_default),
        )
    if not column_exists(bind, "analysis_jobs", "duration_ms"):
        op.add_column("analysis_jobs", sa.Column("duration_ms", sa.Integer(), nullable=True))

    if not index_exists(bind, "analysis_jobs", "ix_analysis_jobs_version_status"):
        op.create_index(
            "ix_analysis_jobs_version_status",
            "analysis_jobs",
            ["analysis_version", "status"],
            unique=False,
        )
    if not index_exists(bind, "analysis_jobs", "ix_analysis_jobs_pr_version"):
        op.create_index(
            "ix_analysis_jobs_pr_version",
            "analysis_jobs",
            ["pull_request_id", "analysis_version"],
            unique=False,
        )

    if not table_exists(bind, "analysis_cache_events"):
        op.create_table(
            "analysis_cache_events",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("pull_request_id", sa.String(64), sa.ForeignKey("pull_requests.id"), nullable=True),
            sa.Column("analysis_version", sa.String(128), nullable=True),
            sa.Column("job_id", sa.String(64), sa.ForeignKey("analysis_jobs.id"), nullable=True),
            sa.Column("cache_hit", sa.Boolean(), nullable=False, server_default=cache_hit_default),
            sa.Column("saved_duration_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "estimated_cost_usd",
                sa.Numeric(10, 4),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
        op.create_index(
            "ix_analysis_cache_events_created_at",
            "analysis_cache_events",
            ["created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if table_exists(bind, "analysis_cache_events"):
        op.drop_table("analysis_cache_events")

    for idx in ("ix_analysis_jobs_pr_version", "ix_analysis_jobs_version_status"):
        if index_exists(bind, "analysis_jobs", idx):
            op.drop_index(idx, table_name="analysis_jobs")

    for col in (
        "duration_ms",
        "cache_hit",
        "source_job_id",
        "phase",
        "base_sha",
        "head_sha",
        "analysis_version",
    ):
        if column_exists(bind, "analysis_jobs", col):
            op.drop_column("analysis_jobs", col)

    if index_exists(bind, "pull_requests", "ix_pull_requests_repo_number_head"):
        op.drop_index("ix_pull_requests_repo_number_head", table_name="pull_requests")

    for col in ("analysis_version", "base_sha", "head_sha"):
        if column_exists(bind, "pull_requests", col):
            op.drop_column("pull_requests", col)
