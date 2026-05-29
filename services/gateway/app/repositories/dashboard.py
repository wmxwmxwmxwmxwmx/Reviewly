from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, PullRequest, Repository
from app.mock import seed


def get_dashboard(session: Session) -> dict:
    open_prs = session.scalar(
        select(func.count()).select_from(PullRequest).where(PullRequest.state == "open")
    )
    if open_prs == 0:
        return seed.get_dashboard()

    security_count = session.scalar(
        select(func.count())
        .select_from(AnalysisFinding)
        .where(AnalysisFinding.type == "security")
    ) or 0

    repos = session.scalars(select(Repository)).all()
    top_repos = []
    for repo in repos[:5]:
        payload = repo.payload or {}
        top_repos.append(
            {
                "name": payload.get("fullName", repo.full_name).split("/")[-1],
                "prs": payload.get("openPrCount", 0),
                "issues": 0,
                "health": payload.get("healthScore", 80),
            }
        )

    base = seed.get_dashboard()
    base["pendingPrs"] = open_prs or base["pendingPrs"]
    base["securityIssues"] = security_count or base["securityIssues"]
    if top_repos:
        base["topRepos"] = top_repos
    return base
