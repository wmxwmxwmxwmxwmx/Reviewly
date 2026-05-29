"""Remove demo seed rows from the database (one-off local cleanup)."""
from __future__ import annotations

from sqlalchemy import delete, or_, select

from app.core.config import settings
from app.db.models import (
    AnalysisFinding,
    AnalysisJob,
    GovernanceViolation,
    PullRequest,
    PullRequestDiff,
    Repository,
)
from app.db.session import SessionLocal
from app.repositories.seed_filter import (
    LEGACY_SEED_PULL_REQUEST_IDS,
    LEGACY_SEED_REPOSITORY_IDS,
    seed_repository_predicate,
)


def main() -> None:
    session = SessionLocal()
    try:
        seed_repo_ids = list(
            session.scalars(
                select(Repository.id).where(seed_repository_predicate())
            ).all()
        )
        pr_conditions = [PullRequest.id.in_(tuple(LEGACY_SEED_PULL_REQUEST_IDS))]
        if seed_repo_ids:
            pr_conditions.append(PullRequest.repository_id.in_(seed_repo_ids))
        seed_pr_ids = list(
            session.scalars(select(PullRequest.id).where(or_(*pr_conditions))).all()
        )

        if seed_pr_ids:
            session.execute(
                delete(AnalysisFinding).where(
                    AnalysisFinding.job_id.in_(
                        select(AnalysisJob.id).where(
                            AnalysisJob.pull_request_id.in_(seed_pr_ids)
                        )
                    )
                )
            )
            session.execute(
                delete(AnalysisJob).where(AnalysisJob.pull_request_id.in_(seed_pr_ids))
            )
            session.execute(
                delete(GovernanceViolation).where(
                    GovernanceViolation.pull_request_id.in_(seed_pr_ids)
                )
            )
            session.execute(
                delete(PullRequestDiff).where(
                    PullRequestDiff.pull_request_id.in_(seed_pr_ids)
                )
            )
            session.execute(delete(PullRequest).where(PullRequest.id.in_(seed_pr_ids)))

        if seed_repo_ids:
            session.execute(delete(Repository).where(Repository.id.in_(seed_repo_ids)))

        session.commit()
        print(
            f"Purged seed data: {len(seed_repo_ids)} repositories, {len(seed_pr_ids)} pull requests"
        )
        print(f"Database: {settings.database_url.split('://')[0]}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
