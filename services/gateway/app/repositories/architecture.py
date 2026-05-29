from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import Repository


def _empty_graph() -> dict:
    return {
        "nodes": [],
        "edges": [],
        "metrics": {
            "cycles": [],
            "giantModules": [],
            "layerViolations": [],
            "summary": {"fileCount": 0, "edgeCount": 0, "languages": {}},
        },
        "status": "empty",
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
    return _empty_graph()
