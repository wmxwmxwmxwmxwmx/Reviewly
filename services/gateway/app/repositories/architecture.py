from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import Repository


def _mock_graph(session: Session, repo_id: str) -> dict:
    repo = session.get(Repository, repo_id)
    label = repo_id
    if repo and repo.payload:
        label = repo.payload.get("fullName", repo.full_name).split("/")[-1]
    elif repo:
        label = repo.full_name.split("/")[-1]

    return {
        "nodes": [
            {"id": repo_id, "label": label, "path": repo_id, "layer": "module", "language": "unknown"},
            {"id": f"{repo_id}-api", "label": "api-gateway", "path": "api", "layer": "controller", "language": "typescript"},
            {"id": f"{repo_id}-payment", "label": "payment-service", "path": "payment", "layer": "service", "language": "python"},
            {"id": f"{repo_id}-auth", "label": "auth-service", "path": "auth", "layer": "service", "language": "python"},
        ],
        "edges": [
            {"from": f"{repo_id}-api", "to": f"{repo_id}-payment", "kind": "import"},
            {"from": f"{repo_id}-api", "to": f"{repo_id}-auth", "kind": "import"},
            {"from": repo_id, "to": f"{repo_id}-api", "kind": "import"},
        ],
        "metrics": {
            "cycles": [],
            "giantModules": [],
            "layerViolations": [],
            "summary": {"fileCount": 4, "edgeCount": 3, "languages": {}},
        },
        "status": "ok",
    }


def save_scan_result(session: Session, repo_id: str, graph: dict) -> None:
    row = session.get(Repository, repo_id)
    if row is None:
        return
    row.architecture_graph = deepcopy(graph)
    row.architecture_scanned_at = datetime.now(timezone.utc)
    session.commit()


def get_dependency_graph(session: Session, repo_id: str) -> dict:
    repo = session.get(Repository, repo_id)
    if repo and repo.architecture_graph:
        out = deepcopy(repo.architecture_graph)
        out.setdefault("status", "ok")
        return out
    return _mock_graph(session, repo_id)
