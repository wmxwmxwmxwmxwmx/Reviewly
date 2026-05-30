import asyncio
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.architecture.graph_builder import build_graph
from app.repositories import architecture as architecture_repo
from app.services.repo_clone import ensure_repo_clone


async def run_scan(session: Session, repo_id: str) -> dict:
    clone_info = await ensure_repo_clone(session, repo_id)
    root = Path(clone_info["path"])
    graph = await asyncio.to_thread(build_graph, root)
    graph["scannedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    graph["cachePath"] = str(root)
    architecture_repo.save_scan_result(session, repo_id, graph)
    return graph
