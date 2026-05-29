from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob
from app.repositories.analysis import _finding_to_api
from app.repositories.performance_center import (
    get_finding_with_context,
    list_performance_findings_filtered,
)


def list_performance_findings(session: Session) -> list[dict[str, Any]]:
    rows = session.scalars(
        select(AnalysisFinding).where(AnalysisFinding.type == "performance")
    ).all()
    return [_finding_to_api(r) for r in rows]


def get_performance_stats(session: Session) -> dict[str, Any]:
    findings = list_performance_findings(session)
    high = sum(1 for f in findings if f.get("severity") in ("critical", "high"))
    return {
        "openFindings": len(findings),
        "avgImpact": "high" if high > 2 else "medium" if high else "low",
        "status": "ok",
    }


def get_finding(session: Session, finding_id: str) -> dict[str, Any] | None:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "performance":
        return None
    return _finding_to_api(row)


def create_finding(session: Session, body: dict[str, Any]) -> dict[str, Any]:
    job = session.scalar(select(AnalysisJob).limit(1))
    job_id = body.get("jobId") or (job.id if job else f"job-seed-{uuid.uuid4().hex[:8]}")
    fid = body.get("id") or f"perf-{uuid.uuid4().hex[:8]}"
    row = AnalysisFinding(
        id=fid,
        job_id=job_id,
        type="performance",
        severity=body.get("severity", "medium"),
        title=body.get("title", ""),
        file=body.get("file", ""),
        line=int(body.get("line", 0)),
        payload=deepcopy(body),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _finding_to_api(row)


def update_finding(session: Session, finding_id: str, body: dict[str, Any]) -> dict[str, Any] | None:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "performance":
        return None
    payload = deepcopy(row.payload) if row.payload else _finding_to_api(row)
    payload.update(body)
    row.severity = payload.get("severity", row.severity)
    row.title = payload.get("title", row.title)
    row.file = payload.get("file", row.file)
    row.line = int(payload.get("line", row.line))
    row.payload = payload
    session.commit()
    session.refresh(row)
    return _finding_to_api(row)


__all__ = [
    "list_performance_findings",
    "list_performance_findings_filtered",
    "get_performance_stats",
    "get_finding",
    "get_finding_with_context",
    "create_finding",
    "update_finding",
    "delete_finding",
]


def delete_finding(session: Session, finding_id: str) -> bool:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "performance":
        return False
    session.delete(row)
    session.commit()
    return True
