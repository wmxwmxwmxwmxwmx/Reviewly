"""Orchestrate clone + scan + persist architecture graph."""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.architecture.graph_builder import build_graph
from app.repositories import architecture as architecture_repo
from app.services.repo_clone import clone_has_scannable_sources, ensure_repo_clone

ProgressFn = Callable[[str, int, int | None, str], None]


def _progress_event(
    phase: str,
    percent: int,
    message: str,
    *,
    current: int | None = None,
    total: int | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "phase": phase,
        "percent": max(0, min(100, percent)),
        "message": message,
    }
    if current is not None:
        payload["current"] = current
    if total is not None:
        payload["total"] = total
    return {"progress": payload}


def _percent_for_build_phase(phase: str, current: int, total: int | None) -> int:
    if phase == "discover":
        if total and total > 0 and current >= total:
            return 45
        return 38
    if not total or total <= 0:
        return 55
    ratio = current / total
    if phase == "nodes":
        return 45 + int(20 * ratio)
    if phase == "edges":
        return 65 + int(23 * ratio)
    if phase == "metrics":
        return 92
    return 50


async def stream_run_scan(session: Session, repo_id: str) -> AsyncIterator[dict[str, Any]]:
    yield _progress_event("prepare", 2, "准备扫描…")

    yield _progress_event("clone", 8, "正在克隆或读取仓库缓存…")
    clone_info = await ensure_repo_clone(session, repo_id)
    cached = bool(clone_info.get("cached"))
    root = Path(clone_info["path"])

    if cached and not clone_has_scannable_sources(root):
        yield _progress_event("clone", 12, "缓存无效，正在重新克隆…")
        clone_info = await ensure_repo_clone(session, repo_id, force_refresh=True)
        cached = False
        root = Path(clone_info["path"])

    yield _progress_event(
        "clone",
        35,
        "已使用本地缓存" if cached else "仓库克隆完成",
    )
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    def on_build_progress(phase: str, current: int, total: int | None, message: str) -> None:
        percent = _percent_for_build_phase(phase, current, total)
        loop.call_soon_threadsafe(
            queue.put_nowait,
            _progress_event(phase, percent, message, current=current, total=total),
        )

    async def build_worker() -> None:
        try:
            graph = await asyncio.to_thread(build_graph, root, on_build_progress)
            if not graph.get("nodes") and not clone_has_scannable_sources(root):
                raise RuntimeError(
                    "未发现可分析的源文件（支持 Python / TypeScript / C++）。"
                    "请确认仓库已正确克隆；私有仓库需在 services/gateway/.env 配置 GITHUB_PAT。"
                )
            graph["scannedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            graph["cachePath"] = str(root)
            loop.call_soon_threadsafe(
                queue.put_nowait,
                _progress_event("save", 96, "正在保存依赖图…"),
            )
            architecture_repo.save_scan_result(session, repo_id, graph)
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {
                    "complete": True,
                    "nodeCount": len(graph.get("nodes", [])),
                    "edgeCount": len(graph.get("edges", [])),
                },
            )
        except Exception as exc:  # noqa: BLE001
            loop.call_soon_threadsafe(queue.put_nowait, {"error": str(exc)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    worker = asyncio.create_task(build_worker())
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=25.0)
            except asyncio.TimeoutError:
                yield {"ping": True}
                continue
            if item is None:
                break
            if "error" in item:
                raise RuntimeError(str(item["error"]))
            yield item
    finally:
        await worker


async def run_scan(session: Session, repo_id: str) -> dict:
    complete = False
    async for event in stream_run_scan(session, repo_id):
        if event.get("complete"):
            complete = True
    if not complete:
        raise RuntimeError("扫描未正常完成")
    graph = architecture_repo.get_dependency_graph(session, repo_id)
    if not graph.get("nodes") and graph.get("status") == "empty":
        raise RuntimeError("扫描未返回依赖图")
    return graph
