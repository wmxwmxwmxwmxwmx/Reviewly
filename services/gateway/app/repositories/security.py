from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob
from app.repositories.analysis import _finding_to_api, get_security_stats, list_security_findings
from app.repositories.security_center import (
    get_finding_with_context,
    list_security_findings_filtered,
)


def get_finding(session: Session, finding_id: str) -> dict[str, Any] | None:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "security":
        return None
    return _finding_to_api(row)


def create_finding(session: Session, body: dict[str, Any]) -> dict[str, Any]:
    job = session.scalar(select(AnalysisJob).limit(1))
    job_id = body.get("jobId") or (job.id if job else f"job-seed-{uuid.uuid4().hex[:8]}")
    fid = body.get("id") or f"sec-{uuid.uuid4().hex[:8]}"
    payload = deepcopy(body)
    payload["id"] = fid
    row = AnalysisFinding(
        id=fid,
        job_id=job_id,
        type="security",
        severity=body.get("severity", "medium"),
        title=body.get("title", ""),
        file=body.get("file", ""),
        line=int(body.get("line", 0)),
        payload=payload,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _finding_to_api(row)


def update_finding(session: Session, finding_id: str, body: dict[str, Any]) -> dict[str, Any] | None:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "security":
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


def delete_finding(session: Session, finding_id: str) -> bool:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "security":
        return False
    session.delete(row)
    session.commit()
    return True


__all__ = [
    "list_security_findings",
    "list_security_findings_filtered",
    "get_security_stats",
    "get_finding",
    "get_finding_with_context",
    "create_finding",
    "update_finding",
    "delete_finding",
]
