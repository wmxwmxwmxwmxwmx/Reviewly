"""B5–B9 domain REST APIs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.deps import get_db
from app.repositories import analysis as analysis_repo
from app.repositories import governance as governance_repo
from app.repositories import performance as performance_repo
from app.repositories import security as security_repo
from app.repositories import team as team_repo

router = APIRouter(prefix="/api", tags=["domain"])


@router.get("/security/findings")
def security_findings_list(
    severity: str | None = None,
    repo: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    db: Session = Depends(get_db),
) -> dict:
    items, total = security_repo.list_security_findings_filtered(
        db,
        severity=severity,
        repo=repo,
        q=q,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


@router.get("/security/stats")
def security_stats(db: Session = Depends(get_db)) -> dict:
    return security_repo.get_security_stats(db)


@router.get("/security/findings/{finding_id}")
def security_finding_get(finding_id: str, db: Session = Depends(get_db)) -> dict:
    row = security_repo.get_finding(db, finding_id)
    if not row:
        raise api_error("安全发现不存在", 404)
    return row


@router.post("/security/findings")
def security_finding_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return security_repo.create_finding(db, body)


@router.patch("/security/findings/{finding_id}")
def security_finding_update(finding_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    row = security_repo.update_finding(db, finding_id, body)
    if not row:
        raise api_error("安全发现不存在", 404)
    return row


@router.delete("/security/findings/{finding_id}")
def security_finding_delete(finding_id: str, db: Session = Depends(get_db)) -> dict:
    if not security_repo.delete_finding(db, finding_id):
        raise api_error("安全发现不存在", 404)
    return {"ok": True}


@router.get("/performance/stats")
def performance_stats(
    repo: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    return performance_repo.get_performance_stats(db, repo=repo)


@router.get("/performance/findings")
def performance_findings(
    severity: str | None = None,
    perf_type: str | None = Query(None, alias="type"),
    repo: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    db: Session = Depends(get_db),
) -> dict:
    items, total = performance_repo.list_performance_findings_filtered(
        db,
        severity=severity,
        perf_type=perf_type,
        repo=repo,
        q=q,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "pageSize": page_size}


@router.get("/performance/findings/{finding_id}")
def performance_finding_get(finding_id: str, db: Session = Depends(get_db)) -> dict:
    row = performance_repo.get_finding(db, finding_id)
    if not row:
        raise api_error("性能发现不存在", 404)
    return row


@router.post("/performance/findings")
def performance_finding_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return performance_repo.create_finding(db, body)


@router.patch("/performance/findings/{finding_id}")
def performance_finding_update(finding_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    row = performance_repo.update_finding(db, finding_id, body)
    if not row:
        raise api_error("性能发现不存在", 404)
    return row


@router.delete("/performance/findings/{finding_id}")
def performance_finding_delete(finding_id: str, db: Session = Depends(get_db)) -> dict:
    if not performance_repo.delete_finding(db, finding_id):
        raise api_error("性能发现不存在", 404)
    return {"ok": True}


class GovernanceRuleBody(BaseModel):
    rule: str = Field(min_length=1, max_length=1024)
    severity: str = "medium"
    enabled: bool = True
    description: str | None = None
    match_type: str = Field(default="keyword", validation_alias="matchType")
    keywords: list[str] | str = Field(default_factory=list)
    file_patterns: list[str] | str = Field(default_factory=list, validation_alias="filePatterns")
    finding_types: list[str] = Field(default_factory=list, validation_alias="findingTypes")
    finding_severities: list[str] = Field(default_factory=list, validation_alias="findingSeverities")

    model_config = {"populate_by_name": True}


class GovernanceRulePatchBody(BaseModel):
    rule: str | None = Field(default=None, min_length=1, max_length=1024)
    severity: str | None = None
    enabled: bool | None = None
    description: str | None = None
    match_type: str | None = Field(default=None, validation_alias="matchType")
    keywords: list[str] | str | None = None
    file_patterns: list[str] | str | None = Field(default=None, validation_alias="filePatterns")
    finding_types: list[str] | None = Field(default=None, validation_alias="findingTypes")
    finding_severities: list[str] | None = Field(default=None, validation_alias="findingSeverities")

    model_config = {"populate_by_name": True}


@router.get("/governance/rules")
def governance_rules(
    include_disabled: bool = Query(False, alias="includeDisabled"),
    db: Session = Depends(get_db),
) -> list:
    return governance_repo.list_rule_definitions(db, include_disabled=include_disabled)


@router.get("/governance/rules/{rule_id}")
def governance_rule_get(rule_id: str, db: Session = Depends(get_db)) -> dict:
    row = governance_repo.get_rule(db, rule_id)
    if not row:
        raise api_error("治理规则不存在", 404)
    return row


@router.post("/governance/rules")
def governance_rule_create(body: GovernanceRuleBody, db: Session = Depends(get_db)) -> dict:
    try:
        return governance_repo.create_rule(db, body.model_dump(by_alias=True))
    except ValueError as exc:
        raise api_error(str(exc), 400) from exc


@router.patch("/governance/rules/{rule_id}")
def governance_rule_update(
    rule_id: str,
    body: GovernanceRulePatchBody,
    db: Session = Depends(get_db),
) -> dict:
    patch = {k: v for k, v in body.model_dump(by_alias=True).items() if v is not None}
    if not patch:
        raise api_error("没有可更新的字段", 400)
    try:
        row = governance_repo.update_rule(db, rule_id, patch)
    except ValueError as exc:
        raise api_error(str(exc), 400) from exc
    if not row:
        raise api_error("治理规则不存在", 404)
    return row


@router.delete("/governance/rules/{rule_id}")
def governance_rule_delete(rule_id: str, db: Session = Depends(get_db)) -> dict:
    if not governance_repo.delete_rule(db, rule_id):
        raise api_error("治理规则不存在", 404)
    return {"ok": True}


@router.get("/governance/violations")
def governance_violations(db: Session = Depends(get_db)) -> list:
    return governance_repo.list_violations(db)


@router.get("/governance/audit-logs")
def governance_audit_logs(db: Session = Depends(get_db)) -> list:
    return governance_repo.list_audit_logs(db)


@router.post("/governance/audit-logs")
def governance_audit_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return governance_repo.create_audit_log(db, body)


@router.get("/team/members")
def team_members(db: Session = Depends(get_db)) -> list:
    return team_repo.list_members(db)


@router.get("/team/members/{member_id}")
def team_member_get(member_id: str, db: Session = Depends(get_db)) -> dict:
    row = team_repo.get_member(db, member_id)
    if not row:
        raise api_error("团队成员不存在", 404)
    return row


@router.post("/team/members")
def team_member_create(body: dict, db: Session = Depends(get_db)) -> dict:
    return team_repo.create_member(db, body)


@router.patch("/team/members/{member_id}")
def team_member_update(member_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    row = team_repo.update_member(db, member_id, body)
    if not row:
        raise api_error("团队成员不存在", 404)
    return row


@router.delete("/team/members/{member_id}")
def team_member_delete(member_id: str, db: Session = Depends(get_db)) -> dict:
    if not team_repo.delete_member(db, member_id):
        raise api_error("团队成员不存在", 404)
    return {"ok": True}


