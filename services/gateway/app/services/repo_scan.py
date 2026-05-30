"""Repository-level security and performance scans over cloned worktrees."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.architecture.walker import iter_source_files
from app.core.config import settings
from app.db.models import AnalysisFinding, AnalysisJob
from app.engine.rules import scan_file
from app.repositories import repository_jobs as rjob_repo
from app.services.repo_clone import ensure_repo_clone

logger = logging.getLogger(__name__)

MAX_SCAN_FILES = 500


def _rel_path(root: Path, file_path: Path) -> str:
    try:
        return file_path.relative_to(root).as_posix()
    except ValueError:
        return file_path.name


def _save_repo_findings(
    session: Session,
    *,
    repository_id: str,
    repository_job_id: str,
    finding_type: str,
    findings: list[dict[str, Any]],
) -> None:
    job = AnalysisJob(
        id=f"job-repo-{uuid.uuid4().hex[:12]}",
        pull_request_id=None,
        repository_id=repository_id,
        repository_job_id=repository_job_id,
        status="completed",
        progress=100,
    )
    session.add(job)
    session.flush()

    for raw in findings:
        fid = raw.get("id") or f"{finding_type}-{uuid.uuid4().hex[:8]}"
        session.add(
            AnalysisFinding(
                id=f"finding-{uuid.uuid4().hex[:12]}",
                job_id=job.id,
                repository_id=repository_id,
                type=finding_type,
                severity=str(raw.get("severity", "medium")),
                title=str(raw.get("title", raw.get("rule", "Finding"))),
                file=str(raw.get("file", "")),
                line=int(raw.get("line", 0)),
                payload=raw,
            )
        )
    session.flush()


async def _scan_repo_files(
    session: Session,
    repository_id: str,
    *,
    repository_job_id: str | None = None,
) -> Path:
    clone_info = await ensure_repo_clone(session, repository_id)
    return Path(clone_info["path"])


def _collect_findings(root: Path, *, finding_type: str) -> list[dict[str, Any]]:
    max_files = getattr(settings, "repo_scan_max_files", MAX_SCAN_FILES)
    files = iter_source_files(root, max_files)
    all_findings: list[dict[str, Any]] = []
    seen: set[str] = set()

    for file_path in files:
        rel = _rel_path(root, file_path)
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            logger.warning("Skip unreadable file %s: %s", rel, exc)
            continue
        for finding in scan_file(rel, content):
            ftype = finding.get("type", finding_type)
            if ftype != finding_type:
                continue
            fid = finding.get("id", "")
            key = f"{fid}:{rel}:{finding.get('line', 0)}"
            if key in seen:
                continue
            seen.add(key)
            finding = {**finding, "file": rel}
            all_findings.append(finding)
    return all_findings


async def run_security_scan(
    session: Session,
    repository_id: str,
    *,
    repository_job_id: str | None = None,
    progress_cb: Any | None = None,
) -> int:
    if progress_cb:
        progress_cb(10, "正在克隆或读取仓库缓存…")
    root = await _scan_repo_files(session, repository_id, repository_job_id=repository_job_id)
    if progress_cb:
        progress_cb(40, "正在扫描安全问题…")
    findings = _collect_findings(root, finding_type="security")
    if progress_cb:
        progress_cb(80, f"发现 {len(findings)} 个安全问题，正在保存…")
    _save_repo_findings(
        session,
        repository_id=repository_id,
        repository_job_id=repository_job_id or "",
        finding_type="security",
        findings=findings,
    )
    if progress_cb:
        progress_cb(100, "安全扫描完成")
    return len(findings)


async def run_performance_scan(
    session: Session,
    repository_id: str,
    *,
    repository_job_id: str | None = None,
    progress_cb: Any | None = None,
) -> int:
    if progress_cb:
        progress_cb(10, "正在克隆或读取仓库缓存…")
    root = await _scan_repo_files(session, repository_id, repository_job_id=repository_job_id)
    if progress_cb:
        progress_cb(40, "正在扫描性能问题…")
    findings = _collect_findings(root, finding_type="performance")
    if progress_cb:
        progress_cb(80, f"发现 {len(findings)} 个性能问题，正在保存…")
    _save_repo_findings(
        session,
        repository_id=repository_id,
        repository_job_id=repository_job_id or "",
        finding_type="performance",
        findings=findings,
    )
    if progress_cb:
        progress_cb(100, "性能扫描完成")
    return len(findings)
