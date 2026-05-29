from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import Repository


def get_dependency_graph(session: Session, repo_id: str) -> dict:
    repo = session.get(Repository, repo_id)
    label = repo_id
    if repo and repo.payload:
        label = repo.payload.get("fullName", repo.full_name).split("/")[-1]
    elif repo:
        label = repo.full_name.split("/")[-1]

    return {
        "nodes": [
            {"id": repo_id, "label": label},
            {"id": f"{repo_id}-api", "label": "api-gateway"},
            {"id": f"{repo_id}-payment", "label": "payment-service"},
            {"id": f"{repo_id}-auth", "label": "auth-service"},
        ],
        "edges": [
            {"from": f"{repo_id}-api", "to": f"{repo_id}-payment"},
            {"from": f"{repo_id}-api", "to": f"{repo_id}-auth"},
            {"from": repo_id, "to": f"{repo_id}-api"},
        ],
        "status": "ok",
    }
