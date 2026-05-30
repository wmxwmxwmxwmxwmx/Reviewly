"""Repository adoption fields and repository_jobs table

Revision ID: 010
Revises: 009
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "repositories",
        sa.Column("managed", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "repositories",
        sa.Column("repository_type", sa.String(32), nullable=False, server_default="owned"),
    )
    op.add_column("repositories", sa.Column("local_path", sa.String(512), nullable=True))
    op.add_column(
        "repositories",
        sa.Column("last_cloned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("repositories", sa.Column("last_commit_sha", sa.String(64), nullable=True))

    op.execute(
        """
        UPDATE repositories
        SET managed = 1, repository_type = 'owned'
        WHERE source_type = 'github' OR source_type IS NULL
        """
    )
    op.execute(
        """
        UPDATE repositories
        SET managed = 0, repository_type = 'external'
        WHERE source_type = 'external'
        """
    )
    op.alter_column("repositories", "managed", server_default=None)
    op.alter_column("repositories", "repository_type", server_default=None)

    op.create_table(
        "repository_jobs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("repository_id", sa.String(64), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("job_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.String(1024), nullable=True),
        sa.Column("parent_job_id", sa.String(64), sa.ForeignKey("repository_jobs.id"), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_repository_jobs_repository_id", "repository_jobs", ["repository_id"])
    op.create_index("ix_repository_jobs_status", "repository_jobs", ["status"])

    with op.batch_alter_table("analysis_jobs") as batch_op:
        batch_op.alter_column("pull_request_id", existing_type=sa.String(64), nullable=True)
        batch_op.add_column(sa.Column("repository_id", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("repository_job_id", sa.String(64), nullable=True))

    op.create_foreign_key(
        "fk_analysis_jobs_repository_id",
        "analysis_jobs",
        "repositories",
        ["repository_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_analysis_jobs_repository_job_id",
        "analysis_jobs",
        "repository_jobs",
        ["repository_job_id"],
        ["id"],
    )

    op.add_column(
        "analysis_findings",
        sa.Column("repository_id", sa.String(64), sa.ForeignKey("repositories.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analysis_findings", "repository_id")
    with op.batch_alter_table("analysis_jobs") as batch_op:
        batch_op.drop_constraint("fk_analysis_jobs_repository_job_id", type_="foreignkey")
        batch_op.drop_constraint("fk_analysis_jobs_repository_id", type_="foreignkey")
        batch_op.drop_column("repository_job_id")
        batch_op.drop_column("repository_id")
        batch_op.alter_column("pull_request_id", existing_type=sa.String(64), nullable=False)

    op.drop_index("ix_repository_jobs_status", table_name="repository_jobs")
    op.drop_index("ix_repository_jobs_repository_id", table_name="repository_jobs")
    op.drop_table("repository_jobs")

    op.drop_column("repositories", "last_commit_sha")
    op.drop_column("repositories", "last_cloned_at")
    op.drop_column("repositories", "local_path")
    op.drop_column("repositories", "repository_type")
    op.drop_column("repositories", "managed")
