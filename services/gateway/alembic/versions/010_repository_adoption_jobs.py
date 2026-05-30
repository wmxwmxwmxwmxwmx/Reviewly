"""Repository adoption fields and repository_jobs table

Revision ID: 010
Revises: 009
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from migration_utils import column_exists, fk_exists, table_exists

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    managed_default = sa.text("true") if dialect == "postgresql" else sa.text("1")

    if not column_exists(bind, "repositories", "managed"):
        op.add_column(
            "repositories",
            sa.Column("managed", sa.Boolean(), nullable=False, server_default=managed_default),
        )
    if not column_exists(bind, "repositories", "repository_type"):
        op.add_column(
            "repositories",
            sa.Column("repository_type", sa.String(32), nullable=False, server_default="owned"),
        )
    if not column_exists(bind, "repositories", "local_path"):
        op.add_column("repositories", sa.Column("local_path", sa.String(512), nullable=True))
    if not column_exists(bind, "repositories", "last_cloned_at"):
        op.add_column(
            "repositories",
            sa.Column("last_cloned_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not column_exists(bind, "repositories", "last_commit_sha"):
        op.add_column("repositories", sa.Column("last_commit_sha", sa.String(64), nullable=True))

    if dialect == "postgresql":
        op.execute(
            """
            UPDATE repositories
            SET managed = true, repository_type = 'owned'
            WHERE (source_type = 'github' OR source_type IS NULL)
              AND (managed IS DISTINCT FROM true OR repository_type IS DISTINCT FROM 'owned')
            """
        )
        op.execute(
            """
            UPDATE repositories
            SET managed = false, repository_type = 'external'
            WHERE source_type = 'external'
              AND (managed IS DISTINCT FROM false OR repository_type IS DISTINCT FROM 'external')
            """
        )
    else:
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

    if dialect != "sqlite":
        if column_exists(bind, "repositories", "managed"):
            op.alter_column("repositories", "managed", server_default=None)
        if column_exists(bind, "repositories", "repository_type"):
            op.alter_column("repositories", "repository_type", server_default=None)

    if not table_exists(bind, "repository_jobs"):
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

    if column_exists(bind, "analysis_jobs", "pull_request_id"):
        with op.batch_alter_table("analysis_jobs") as batch_op:
            batch_op.alter_column("pull_request_id", existing_type=sa.String(64), nullable=True)
            if not column_exists(bind, "analysis_jobs", "repository_id"):
                batch_op.add_column(sa.Column("repository_id", sa.String(64), nullable=True))
            if not column_exists(bind, "analysis_jobs", "repository_job_id"):
                batch_op.add_column(sa.Column("repository_job_id", sa.String(64), nullable=True))
            if not fk_exists(bind, "fk_analysis_jobs_repository_id"):
                batch_op.create_foreign_key(
                    "fk_analysis_jobs_repository_id",
                    "repositories",
                    ["repository_id"],
                    ["id"],
                )
            if not fk_exists(bind, "fk_analysis_jobs_repository_job_id"):
                batch_op.create_foreign_key(
                    "fk_analysis_jobs_repository_job_id",
                    "repository_jobs",
                    ["repository_job_id"],
                    ["id"],
                )
    elif dialect != "sqlite":
        if not fk_exists(bind, "fk_analysis_jobs_repository_id"):
            op.create_foreign_key(
                "fk_analysis_jobs_repository_id",
                "analysis_jobs",
                "repositories",
                ["repository_id"],
                ["id"],
            )
        if not fk_exists(bind, "fk_analysis_jobs_repository_job_id"):
            op.create_foreign_key(
                "fk_analysis_jobs_repository_job_id",
                "analysis_jobs",
                "repository_jobs",
                ["repository_job_id"],
                ["id"],
            )

    if not column_exists(bind, "analysis_findings", "repository_id"):
        op.add_column(
            "analysis_findings",
            sa.Column("repository_id", sa.String(64), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if column_exists(bind, "analysis_findings", "repository_id"):
        op.drop_column("analysis_findings", "repository_id")
    if table_exists(bind, "analysis_jobs"):
        with op.batch_alter_table("analysis_jobs") as batch_op:
            if fk_exists(bind, "fk_analysis_jobs_repository_job_id"):
                batch_op.drop_constraint("fk_analysis_jobs_repository_job_id", type_="foreignkey")
            if fk_exists(bind, "fk_analysis_jobs_repository_id"):
                batch_op.drop_constraint("fk_analysis_jobs_repository_id", type_="foreignkey")
            if column_exists(bind, "analysis_jobs", "repository_job_id"):
                batch_op.drop_column("repository_job_id")
            if column_exists(bind, "analysis_jobs", "repository_id"):
                batch_op.drop_column("repository_id")
            batch_op.alter_column("pull_request_id", existing_type=sa.String(64), nullable=False)

    if table_exists(bind, "repository_jobs"):
        op.drop_index("ix_repository_jobs_status", table_name="repository_jobs")
        op.drop_index("ix_repository_jobs_repository_id", table_name="repository_jobs")
        op.drop_table("repository_jobs")

    for col in ("last_commit_sha", "last_cloned_at", "local_path", "repository_type", "managed"):
        if column_exists(bind, "repositories", col):
            op.drop_column("repositories", col)
